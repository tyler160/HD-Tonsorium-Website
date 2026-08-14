-- HD Tonsorium: run this entire file once in Supabase > SQL Editor > New query.
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  confirmation_code text not null unique,
  service text not null,
  appt_date text not null,
  appt_date_iso date not null,
  appt_time text not null,
  appt_hour24 numeric not null,
  customer_name text not null,
  customer_phone text not null,
  notes text not null default '',
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists bookings_one_active_slot
  on public.bookings (appt_date_iso, appt_time) where status = 'confirmed';

alter table public.bookings enable row level security;

create or replace function public.book_appointment(
  p_confirmation_code text, p_service text, p_appt_date text,
  p_appt_date_iso date, p_appt_time text, p_appt_hour24 numeric,
  p_customer_name text, p_customer_phone text, p_notes text default ''
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare booking public.bookings;
begin
  insert into public.bookings (
    confirmation_code, service, appt_date, appt_date_iso, appt_time,
    appt_hour24, customer_name, customer_phone, notes, user_id
  ) values (
    p_confirmation_code, p_service, p_appt_date, p_appt_date_iso, p_appt_time,
    p_appt_hour24, p_customer_name, p_customer_phone, coalesce(p_notes, ''), auth.uid()
  ) returning * into booking;
  return booking;
exception when unique_violation then
  raise exception 'That appointment time was just booked. Please choose another time.';
end;
$$;

create or replace function public.booked_times(p_date date)
returns table(appt_time text)
language sql security definer set search_path = public
as $$
  select b.appt_time from public.bookings b
  where b.appt_date_iso = p_date and b.status = 'confirmed';
$$;

grant execute on function public.book_appointment(text, text, text, date, text, numeric, text, text, text) to anon, authenticated;
grant execute on function public.booked_times(date) to anon, authenticated;

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.staff_members enable row level security;

create or replace function public.dashboard_bookings()
returns setof public.bookings
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_members where user_id = auth.uid()) then
    raise exception 'Staff access is required.';
  end if;
  return query select * from public.bookings order by appt_date_iso, appt_hour24;
end;
$$;
grant execute on function public.dashboard_bookings() to authenticated;
