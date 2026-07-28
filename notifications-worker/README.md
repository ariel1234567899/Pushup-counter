# Push-Up Tracker notification service

This Cloudflare Worker stores Web Push subscriptions and sends the selected morning/evening reminder according to each device's local time zone. It is required because GitHub Pages cannot send scheduled push notifications on its own.

## One-time deployment

1. Install Node.js 20+ and sign in to Cloudflare: `npx wrangler login`.
2. In this directory, run `npm install`, then create a KV namespace: `npx wrangler kv namespace create SUBSCRIPTIONS`.
3. Paste the returned namespace ID into `wrangler.jsonc` in place of `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
4. Create VAPID keys: `npx web-push generate-vapid-keys`.
5. Set Worker secrets (replace the values):
   - `npx wrangler secret put VAPID_PUBLIC_KEY`
   - `npx wrangler secret put VAPID_PRIVATE_KEY`
   - `npx wrangler secret put VAPID_SUBJECT` (use `mailto:you@example.com`)
   - `npx wrangler secret put ALLOWED_ORIGIN` (use the exact GitHub Pages origin, for example `https://username.github.io`)
6. Run `npm run deploy`. Cloudflare prints the Worker URL.
7. Paste that URL into **Settings → Notification service URL** in the deployed Push-Up Tracker, then turn on **Push reminders** from the installed Home Screen app.

The minute-level cron trigger runs in UTC, while the Worker converts each subscription to the device's saved IANA time zone. Delivery can be delayed by platform scheduling; it is not an exact alarm clock.
