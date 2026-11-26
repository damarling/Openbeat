# OpenBeat (MIT)
Import your Spotify and YouTube / YouTube Music playlists into one library and play them on **Windows/macOS/Linux** (Electron) and **Android** (Capacitor). One shared codebase in `www/`.

## How it works (and why)
- **Spotify** → Web API, OAuth PKCE (no secret). Spotify forbids streaming its audio outside its own SDK, so tracks are matched to YouTube videos for playback.
- **YouTube / YT Music** → YouTube Data API v3 (YT Music has no public API; its playlists are visible via YouTube's). Playback uses the official YouTube IFrame player.

## Setup
1. Spotify: https://developer.spotify.com/dashboard → create app → Redirect URI `http://127.0.0.1:5173/` → copy Client ID.
2. Google Cloud Console → enable *YouTube Data API v3* → OAuth client (Web) with JS origin `http://127.0.0.1:5173` → copy Client ID. Add yourself as a test user.
3. `npm install && npm start`, open ⚙, paste both IDs.

## Android
`npx cap add android && npm run android`, then build from Android Studio. (Google OAuth + Spotify redirects need extra deep-link work on Android — see TODO.)

## TODO / known limits
- Android OAuth deep links (Capacitor App plugin); token refresh; background playback service
- Search quota: YouTube allows ~100 searches/day free; matches are cached
- Queue shuffle, search, export, offline metadata

## Web version (Cloudflare Pages)
`www/` is already a static site: no build step.
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets (drag the `www` folder), or `npx wrangler pages deploy www`.
2. Take your final URL (e.g. `https://openbeat.pages.dev/`, or your custom domain) and add it to:
   - Spotify dashboard → Redirect URIs: `https://openbeat.pages.dev/` (trailing slash, exact match)
   - Google Cloud OAuth client → Authorized JavaScript origins: `https://openbeat.pages.dev`
3. Open the site → ⚙ → paste your Client IDs. They're stored only in that browser's localStorage.
Note: preview deployments (`abc123.openbeat.pages.dev`) are different origins; sign-in only works on URLs you registered.
