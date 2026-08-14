// ---------- header scroll shadow ----------
  const header = document.getElementById('site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- mobile menu ----------
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('primary-nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  // ---------- internal in-page navigation (no href navigation at all) ----------
  function scrollToId(id){
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('.js-scroll').forEach(el => {
    el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
    el.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToId(el.dataset.target);
    });
  });

  // ---------- footer year ----------
  document.getElementById('year').textContent = new Date().getFullYear();

  // =====================================================
  // BOOKING SYSTEM
  // =====================================================
  const SERVICES = [
    { id: 'haircut', name: 'Haircut', dur: '30 min' },
    { id: 'fade', name: 'Fade', dur: '30 min' },
    { id: 'beard', name: 'Beard Trim', dur: '20 min' },
    { id: 'combo', name: 'Haircut + Beard', dur: '45 min' },
    { id: 'kids', name: 'Kids Haircut', dur: '30 min' },
    { id: 'design', name: 'Hair Design', dur: '45 min' },
  ];
  const OPEN_HOUR = 9;    // placeholder open time
  const CLOSE_HOUR = 18.5; // placeholder last-slot time (shop shown closing ~7pm)

  const state = { service: null, dateObj: null, time: null, name: '', phone: '', notes: '', code: null };

  function pad2(n){ return String(n).padStart(2, '0'); }
  function toISODate(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO(){ return toISODate(new Date()); }

  // ---- Internal SQL database (SQLite compiled to WebAssembly, runs entirely in this browser tab) ----
  let db = null;
  const dbReady = initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.4.0/dist/${file}`
  }).then(SQL => {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        confirmation_code TEXT NOT NULL,
        service TEXT NOT NULL,
        appt_date TEXT NOT NULL,
        appt_date_iso TEXT NOT NULL,
        appt_time TEXT NOT NULL,
        appt_hour24 REAL NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT NOT NULL
      );
    `);
    db.run(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        auth_provider TEXT NOT NULL DEFAULT 'password',
        created_at TEXT NOT NULL
      );
    `);
  }).catch(err => console.error('Database failed to initialize:', err));

  const overlay = document.getElementById('booking-overlay');
  const steps = document.querySelectorAll('.booking-step');
  const stepLabel = document.getElementById('booking-step-label');

  function getProg(n){ return document.getElementById('prog-' + n); }

  function showStep(n){
    steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
    const labels = {1:'Service', 2:'Date &amp; Time', 3:'Your Info', 4:'Review'};
    if (n <= 4){
      stepLabel.innerHTML = 'Step ' + n + ' of 4 &middot; ' + labels[n];
    }
    for (let i = 1; i <= 4; i++){
      const el = getProg(i);
      el.classList.toggle('done', i < n);
      el.classList.toggle('active', i === n);
    }
  }

  function openBooking(){
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!state.service) showStep(1);
    document.getElementById('booking-close').focus();
  }
  function closeBooking(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.js-open-booking, .js-open-booking-link').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); openBooking(); });
  });
  document.getElementById('booking-close').addEventListener('click', closeBooking);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBooking(); });

  // ---- Shop dashboard open/close ----
  const dashboardOverlay = document.getElementById('dashboard-overlay');
  async function openDashboard(){
    dashboardOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    await dbReady;
    await renderDashboard();
    document.getElementById('dashboard-close').focus();
  }
  function closeDashboard(){
    dashboardOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('dashboard-open').addEventListener('click', openDashboard);
  document.getElementById('dashboard-close').addEventListener('click', closeDashboard);
  dashboardOverlay.addEventListener('click', (e) => { if (e.target === dashboardOverlay) closeDashboard(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (overlay.classList.contains('open')) closeBooking();
    if (dashboardOverlay.classList.contains('open')) closeDashboard();
  });

  // ---- Step 1: services ----
  const serviceGrid = document.getElementById('service-grid');
  SERVICES.forEach(s => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card';
    card.innerHTML = '<span class="name">' + s.name + '</span><span class="sub">' + s.dur + '</span>';
    card.addEventListener('click', () => {
      state.service = s;
      serviceGrid.querySelectorAll('.pick-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('to-step-2').disabled = false;
    });
    serviceGrid.appendChild(card);
  });
  document.getElementById('to-step-2').addEventListener('click', () => showStep(2));
  document.getElementById('back-step-1').addEventListener('click', () => showStep(1));

  // ---- Step 2: date + time ----
  const dateScroller = document.getElementById('date-scroller');
  const timeGrid = document.getElementById('time-grid');
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function buildDates(){
    dateScroller.innerHTML = '';
    const today = new Date();
    for (let i = 0; i < 14; i++){
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'date-card';
      card.innerHTML = '<div class="dow">' + DOW[d.getDay()] + '</div><div class="dom">' + d.getDate() + '</div><div class="mon">' + MON[d.getMonth()] + '</div>';
      card.addEventListener('click', () => {
        state.dateObj = d;
        state.time = null;
        dateScroller.querySelectorAll('.date-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        buildTimes();
        document.getElementById('to-step-3').disabled = true;
      });
      dateScroller.appendChild(card);
    }
  }

  async function buildTimes(){
    timeGrid.innerHTML = '<p class="slots-loading">Checking availability&hellip;</p>';

    await dbReady;
    const isoDate = toISODate(state.dateObj);
    const bookedTimes = new Set();
    if (db){
      const stmt = db.prepare(`SELECT appt_time FROM bookings WHERE appt_date_iso = ? AND status != 'cancelled'`);
      stmt.bind([isoDate]);
      while (stmt.step()){
        bookedTimes.add(stmt.getAsObject().appt_time);
      }
      stmt.free();
    }

    timeGrid.innerHTML = '';
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h += 0.5){
      const hour24 = Math.floor(h);
      const min = (h % 1 === 0.5) ? '30' : '00';
      const hour12 = ((hour24 + 11) % 12) + 1;
      const ampm = hour24 < 12 ? 'AM' : 'PM';
      const label = hour12 + ':' + min + ' ' + ampm;
      const isBooked = bookedTimes.has(label);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'time-card' + (isBooked ? ' unavailable' : '');
      btn.innerHTML = label + (isBooked ? '<span class="booked-tag">Booked</span>' : '');
      if (isBooked){
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          state.time = { hour24, min, label };
          timeGrid.querySelectorAll('.time-card').forEach(c => c.classList.remove('selected'));
          btn.classList.add('selected');
          document.getElementById('to-step-3').disabled = false;
        });
      }
      timeGrid.appendChild(btn);
    }
  }

  document.getElementById('to-step-3').addEventListener('click', () => showStep(3));
  document.getElementById('back-step-2').addEventListener('click', () => showStep(2));

  // ---- Step 3: contact info ----
  function validateStep3(){
    let ok = true;
    const nameField = document.getElementById('field-name');
    const phoneField = document.getElementById('field-phone');
    const name = document.getElementById('bk-name').value.trim();
    const phone = document.getElementById('bk-phone').value.trim();
    const phoneDigits = phone.replace(/\D/g,'');

    nameField.classList.toggle('invalid', name.length < 2);
    if (name.length < 2) ok = false;

    phoneField.classList.toggle('invalid', phoneDigits.length < 10);
    if (phoneDigits.length < 10) ok = false;

    if (ok){
      state.name = name;
      state.phone = phone;
      state.notes = document.getElementById('bk-notes').value.trim();
    }
    return ok;
  }

  document.getElementById('to-step-4').addEventListener('click', () => {
    if (!validateStep3()) return;
    buildSummary('summary-card');
    showStep(4);
  });
  document.getElementById('back-step-3').addEventListener('click', () => showStep(3));

  function formatDate(d){
    return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
  }

  function buildSummary(targetId){
    const el = document.getElementById(targetId);
    el.innerHTML =
      row('Service', state.service.name) +
      row('Date', formatDate(state.dateObj)) +
      row('Time', state.time.label) +
      row('Name', state.name) +
      row('Phone', state.phone) +
      (state.notes ? row('Notes', state.notes) : '');
  }
  function buildSummaryFromRow(r, targetId){
    const el = document.getElementById(targetId);
    el.innerHTML =
      row('Service', r.service) +
      row('Date', r.appt_date) +
      row('Time', r.appt_time) +
      row('Name', r.customer_name) +
      row('Phone', r.customer_phone) +
      (r.notes ? row('Notes', r.notes) : '');
  }
  function row(k, v){
    return '<div class="summary-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  // ---- Step 4 -> 5: confirm (writes to the internal SQL database, then reads the row back) ----
  const confirmBtn = document.getElementById('confirm-booking');
  document.getElementById('confirm-booking').addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Saving\u2026';
    try{
      await dbReady;
      const code = 'HDT-' + Math.floor(100000 + Math.random() * 900000);

      const insertStmt = db.prepare(
        `INSERT INTO bookings (confirmation_code, service, appt_date, appt_date_iso, appt_time, appt_hour24, customer_name, customer_phone, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
      );
      const hour24Val = state.time.hour24 + (state.time.min === '30' ? 0.5 : 0);
      insertStmt.run([
        code,
        state.service.name,
        formatDate(state.dateObj),
        toISODate(state.dateObj),
        state.time.label,
        hour24Val,
        state.name,
        state.phone,
        state.notes || '',
        new Date().toISOString()
      ]);
      insertStmt.free();

      const selectStmt = db.prepare(`SELECT * FROM bookings WHERE confirmation_code = ?`);
      selectStmt.bind([code]);
      let row_ = null;
      if (selectStmt.step()) row_ = selectStmt.getAsObject();
      selectStmt.free();

      state.code = code;
      document.getElementById('confirm-code').textContent = code;
      buildSummaryFromRow(row_, 'summary-card-2');

      const traceEl = document.getElementById('sql-trace');
      if (traceEl){
        traceEl.textContent =
          "INSERT INTO bookings (...) VALUES (...);\n" +
          "SELECT * FROM bookings WHERE confirmation_code = '" + code + "';\n\n" +
          "\u2192 row " + row_.id + " saved to the in-browser database";
      }

      if (document.getElementById('dashboard-overlay').classList.contains('open')){
        renderDashboard();
      }

      showStep(5);
    } catch(err){
      console.error('Booking save failed:', err);
      alert('Something went wrong saving your booking. Please try again or call the shop directly.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Appointment';
    }
  });

  document.getElementById('close-confirm').addEventListener('click', () => {
    closeBooking();
    // reset for a fresh booking next time
    setTimeout(resetBooking, 300);
  });

  function resetBooking(){
    state.service = null; state.dateObj = null; state.time = null;
    state.name = ''; state.phone = ''; state.notes = ''; state.code = null;
    serviceGrid.querySelectorAll('.pick-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('to-step-2').disabled = true;
    document.getElementById('bk-name').value = '';
    document.getElementById('bk-phone').value = '';
    document.getElementById('bk-notes').value = '';
    document.getElementById('field-name').classList.remove('invalid');
    document.getElementById('field-phone').classList.remove('invalid');
    showStep(1);
  }

  // ---- ICS download (real, functional file) ----
  document.getElementById('download-ics').addEventListener('click', () => {
    const d = new Date(state.dateObj);
    d.setHours(state.time.hour24, Number(state.time.min), 0, 0);
    const end = new Date(d.getTime() + 30 * 60000);
    const fmt = (dt) => dt.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HD Tonsorium Barber Shop//Booking//EN',
      'BEGIN:VEVENT',
      'UID:' + state.code + '@hdtonsoriumkaty.com',
      'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(d),
      'DTEND:' + fmt(end),
      'SUMMARY:' + state.service.name + ' at HD Tonsorium Barber Shop',
      'DESCRIPTION:Confirmation ' + state.code + '. Call (281) 815-5999 with questions.',
      'LOCATION:6037 N Fry Rd #100\\, Katy\\, TX 77449',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hd-tonsorium-appointment.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  buildDates();

  // =====================================================
  // ACCOUNTS (email/password stored hashed in the internal SQL
  // database, plus a Google Sign-In entry point)
  // =====================================================
  let currentUser = null; // { id, name, email } — in-memory for this session only

  async function hashPassword(password){
    const enc = new TextEncoder().encode('hdtonsorium-demo-salt::' + password);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const accountOverlay = document.getElementById('account-overlay');
  const accountOpenBtn = document.getElementById('account-open');
  const accountOpenLabel = document.getElementById('account-open-label');
  const guestView = document.getElementById('account-guest-view');
  const userView = document.getElementById('account-user-view');

  function openAccount(){
    accountOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    refreshAccountView();
    document.getElementById('account-close').focus();
  }
  function closeAccount(){
    accountOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  accountOpenBtn.addEventListener('click', openAccount);
  document.getElementById('account-close').addEventListener('click', closeAccount);
  accountOverlay.addEventListener('click', (e) => { if (e.target === accountOverlay) closeAccount(); });

  function refreshAccountView(){
    if (currentUser){
      guestView.style.display = 'none';
      userView.style.display = 'block';
      document.getElementById('account-name-display').textContent = currentUser.name;
      document.getElementById('account-email-display').textContent = currentUser.email;
      document.getElementById('account-subtitle').textContent = 'Signed in';
    } else {
      guestView.style.display = 'block';
      userView.style.display = 'none';
      document.getElementById('account-subtitle').textContent = 'Sign in for faster booking';
    }
  }

  function setLoggedIn(user){
    currentUser = user;
    accountOpenLabel.textContent = user.name.split(' ')[0];
    accountOpenBtn.querySelector('svg use').setAttribute('href', '#icon-check');
    refreshAccountView();
  }
  function setLoggedOut(){
    currentUser = null;
    accountOpenLabel.textContent = 'Sign In';
    accountOpenBtn.querySelector('svg use').setAttribute('href', '#icon-user');
    refreshAccountView();
  }

  // ---- tab switching ----
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
      document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
    });
  });

  function showAuthError(id, msg){
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearAuthErrors(){
    document.querySelectorAll('.auth-error').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('.booking-field').forEach(f => f.classList.remove('invalid'));
  }

  // ---- sign up ----
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const pw = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    let ok = true;

    if (!name){ document.getElementById('signup-name-field').classList.add('invalid'); ok = false; }
    if (!emailOk){ document.getElementById('signup-email-field').classList.add('invalid'); ok = false; }
    if (pw.length < 8){ document.getElementById('signup-password-field').classList.add('invalid'); ok = false; }
    if (confirm !== pw){ document.getElementById('signup-confirm-field').classList.add('invalid'); ok = false; }
    if (!ok) return;

    await dbReady;
    const existing = db.prepare(`SELECT id FROM accounts WHERE email = ?`);
    existing.bind([email]);
    const taken = existing.step();
    existing.free();
    if (taken){
      showAuthError('signup-error', 'An account with that email already exists — try logging in instead.');
      return;
    }

    const hash = await hashPassword(pw);
    const stmt = db.prepare(`INSERT INTO accounts (name, email, password_hash, auth_provider, created_at) VALUES (?, ?, ?, 'password', ?)`);
    stmt.run([name, email, hash, new Date().toISOString()]);
    stmt.free();

    const idRes = db.exec('SELECT last_insert_rowid() AS id');
    const newId = idRes[0].values[0][0];

    setLoggedIn({ id: newId, name, email });
    closeAccount();
  });

  // ---- log in ----
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pw = document.getElementById('login-password').value;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    let ok = true;
    if (!emailOk){ document.getElementById('login-email-field').classList.add('invalid'); ok = false; }
    if (!pw){ document.getElementById('login-password-field').classList.add('invalid'); ok = false; }
    if (!ok) return;

    await dbReady;
    const hash = await hashPassword(pw);
    const stmt = db.prepare(`SELECT id, name, email FROM accounts WHERE email = ? AND password_hash = ?`);
    stmt.bind([email, hash]);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();

    if (!row){
      showAuthError('login-error', 'Email or password is incorrect.');
      return;
    }
    setLoggedIn(row);
    closeAccount();
  });

  document.getElementById('account-logout').addEventListener('click', () => {
    setLoggedOut();
  });

  // ---- Google Sign-In ----
  // Ready to go live: this uses Google's real Identity Services library.
  // Replace GOOGLE_CLIENT_ID below with a Client ID from Google Cloud Console
  // (registered to this site's real domain) to activate it.
  const GOOGLE_CLIENT_ID = '823851769612-0tt5hvckchh0o2kuofurrcqbjh7tfmk4.apps.googleusercontent.com';

  document.getElementById('google-signin-btn').addEventListener('click', () => {
    const note = document.getElementById('google-note');
    if (GOOGLE_CLIENT_ID.startsWith('YOUR_')){
      note.textContent = 'This button is wired up and ready — add a real Google OAuth Client ID (Google Cloud Console) for this site\u2019s domain to activate it.';
      note.classList.add('show');
      return;
    }
    // With a real client ID configured, this initializes Google's official
    // sign-in flow and creates/logs in the matching account automatically.
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential
    });
    google.accounts.id.prompt();
  });

  async function handleGoogleCredential(response){
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = (payload.email || '').toLowerCase();
    const name = payload.name || email;
    await dbReady;

    const existing = db.prepare(`SELECT id, name, email FROM accounts WHERE email = ?`);
    existing.bind([email]);
    let row = null;
    if (existing.step()) row = existing.getAsObject();
    existing.free();

    if (row){
      setLoggedIn(row);
    } else {
      const stmt = db.prepare(`INSERT INTO accounts (name, email, auth_provider, created_at) VALUES (?, ?, 'google', ?)`);
      stmt.run([name, email, new Date().toISOString()]);
      stmt.free();
      const idRes = db.exec('SELECT last_insert_rowid() AS id');
      setLoggedIn({ id: idRes[0].values[0][0], name, email });
    }
    closeAccount();
  }

  // ---- prefill the booking form's name field once signed in ----
  const originalOpenBooking = openBooking;
  openBooking = function(){
    originalOpenBooking();
    if (currentUser){
      const nameInput = document.getElementById('bk-name');
      if (nameInput && !nameInput.value) nameInput.value = currentUser.name;
    }
  };
