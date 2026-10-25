# VolunteerKC Admin

Web admin page for the VolunteerKC API (`https://www.chuckbrandt.com/VKC/docs`).
Sign in with an app account that has `role = admin` (`python make_admin.py you@example.com`).

- **Push notifications**: to everyone, everyone signed up for an event, or chosen volunteers (iOS + Android via Firebase)
- **Text messages**: to everyone signed up for an event, or chosen volunteers (Twilio)
- **Events**: upcoming events with signup counts and who signed up; "Text everyone signed up"
- **Volunteers**: search, multi-select, then text or notify
- **History**: everything sent, by whom, and how many it reached

## Develop

```
npm install
npm run dev        # http://localhost:5173, /VKC is proxied to the live API
```

**Careful:** the dev server talks to the live API by default, so anything you send goes to real
volunteers. To use a local API, create `.env.local` with `VITE_API_PROXY=http://localhost:8000`.

## Deploy (cPanel)

```
npm run build
```

### Hosting elsewhere (e.g. Render static site)

1. In the Render service's **Environment**, add `VITE_API_BASE` = `https://www.chuckbrandt.com/VKC`
   (it's baked in at build time, so redeploy afterwards). Build command `npm install && npm run build`,
   publish directory `dist`.
2. In the API's `.env` on cPanel add `CORS_ORIGINS=https://admin-8uw5.onrender.com` (comma-separate
   several origins, no trailing slash), then `touch ~/vkc_api/tmp/restart.txt`.

### Same site as the API (cPanel)

Upload the contents of `dist/` to a folder on the same site as the API, e.g. `public_html/VKC-admin/`,
then open `https://www.chuckbrandt.com/VKC-admin/`. Paths are relative and routing is hash-based
(`#/texts`), so no rewrite rules are needed. Because it's on the same domain as the API, no CORS
setup is needed either. (If you host it elsewhere, set `VITE_API_BASE=https://www.chuckbrandt.com/VKC`
before building and add that site's origin to `CORS_ORIGINS` in the API's `.env`.)
