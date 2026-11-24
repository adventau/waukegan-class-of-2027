# How WHS27.com works

- **Live site:** https://whs27.com (also https://www.whs27.com and https://whs2027.pages.dev)
- **Admin page:** https://whs27.com/admin (not linked anywhere; password in `ADMIN-PASSWORD.txt`, which is never uploaded)
- **Hosting:** Cloudflare Pages project `whs2027`, with a D1 database `whs2027` and a KV store `whs2027-files` for uploaded photos.
- **Backup:** this folder is the GitHub repo `adventau/waukegan-class-of-2027`.

## Folders

| Path | What it is |
|---|---|
| `dist/` | The website pages, styles, images and scripts |
| `dist/site-live.js` | Connects pages to the server: forms, approved photos, switches, visit counts, error reports |
| `dist/admin/` | The admin page (only served to the signed-in admin) |
| `functions/` | Server code that runs on Cloudflare (`/api/*` and the `/admin` lock) |
| `lib/` | Shared server code: sign-in, forms, editable content |
| `migrations/` | Database tables |

## Publishing an update

```sh
export PATH="$HOME/.local/node/bin:$PATH"
npx wrangler pages deploy dist --project-name whs2027 --branch main
git add -A && git commit -m "Describe the change" && git push
```

Database changes: add a new file in `migrations/`, then `npm run db:remote`.

## Testing on this computer

```sh
export PATH="$HOME/.local/node/bin:$PATH"
npm run db:local   # first time only
npm run dev        # then open http://127.0.0.1:8788
```

Local secrets live in `.dev.vars` (never uploaded).
