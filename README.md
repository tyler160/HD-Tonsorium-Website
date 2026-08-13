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
- **Booking database**: bookings and accounts are stored in a real SQLite database that runs entirely in the visitor's browser (via sql.js/WebAssembly). It resets when the page reloads — connecting this to a real backend/server is the next step for it to persist permanently.
- **Google Sign-In**: the button is fully wired to Google's real Identity Services library. Add a real Client ID (from Google Cloud Console, registered to the live domain) in `js/main.js` — search for `GOOGLE_CLIENT_ID`.
