# HD Tonsorium Barber Shop — Website

## Structure
```
hd-tonsorium-website/
├── index.html      # page markup
├── css/
│   └── style.css   # all styling
└── js/
    └── main.js     # nav, booking flow, SQL database, accounts
```

Open `index.html` directly in a browser to view the site — no build step or server required.

## Notes for whoever maintains this next
- **Photos**: gallery and hero sections currently use placeholder illustrations. Each gallery tile has a `data-replace-with="filename.jpg"` attribute marking what real photo belongs there.
- **Hours**: the Hours section uses `[Hours]` placeholders — confirm real daily hours and update `index.html`.
- **Booking database**: bookings and accounts are stored in a real, persistent Supabase (Postgres) backend — see `supabase-setup.sql` for the schema/RPCs, and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` near the top of `js/main.js`.
- **Google Sign-In**: wired to Google's real Identity Services library with a live Client ID (`GOOGLE_CLIENT_ID` in `js/main.js`). It renders Google's actual button invisibly on top of the styled "Continue with Google" button, so styling stays custom but the click always hits Google's real, reliable flow — plain `prompt()`/One Tap calls increasingly fail silently in Chrome, so avoid switching back to that alone.
  - **If the button ever stops working again**: open the browser console (F12) — errors here will say exactly what broke (bad Client ID, wrong authorized origin in Google Cloud Console, Supabase key issue, etc).
  - The Client ID must be registered in Google Cloud Console with this site's real, live domain as an **Authorized JavaScript origin** — it will not work from `file://` or from a domain that isn't registered there.
- **Owner/Staff dashboard access**: a signed-in user only sees appointment data if their user ID has been added to the `staff_members` table in Supabase (SQL Editor: `insert into public.staff_members (user_id) values ('<their-auth-uid>');`). Sign in as yourself first (Google or email), grab your UID from Supabase Auth > Users, then add that row — otherwise the dashboard will say "Sign in with the shop owner account" even while logged in.
- **Finding the dashboard**: click "Shop Dashboard" in the footer, or bookmark the site with `#dashboard` on the end of the URL (e.g. `https://yoursite.com/#dashboard`) to jump straight to it.
