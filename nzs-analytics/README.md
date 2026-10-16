# NZS Analytics Worker

A TypeScript Cloudflare Worker and D1 database for counting observed extension IDs and recording verified purchase status. It stores one user row per UUID and one activity row per user per UTC day. It does not collect article URLs, browsing history, or email addresses.

## API

| Endpoint | Caller | Body | Result |
| --- | --- | --- | --- |
| `POST /v1/seen` | Extension background script | `{ "userId": "<version-4 UUID>" }` | Records first and latest activity and a daily activity row. Repeated reports on the same day do not increase the daily unique count. |
| `POST /v1/purchase` | Trusted purchase service only | `{ "userId": "<version-4 UUID>", "purchased": true }` | Sets or revokes a verified purchase. Requires `Authorization: Bearer <PURCHASE_TOKEN>`. |
| `GET /v1/metrics` | Administrator only | None | Returns lifetime unique IDs, purchased IDs, IDs active in the last 30 days, and IDs active today (UTC). Requires `Authorization: Bearer <ADMIN_TOKEN>`. |

The public `/v1/seen` endpoint validates UUIDs but cannot prove that a request came from a genuine extension installation. Treat these as usage estimates. Keep `/v1/purchase` and `/v1/metrics` secrets out of extension code.

## Run locally

```sh
npm install
cp .dev.vars.example .dev.vars
# Replace both example token values in .dev.vars with random secrets.
npm run db:migrate:local
npm run dev
```

The local Worker runs at `http://localhost:8787` by default. `npm run typecheck` checks the TypeScript source.

## Deploy

1. Authenticate Wrangler with your Cloudflare account: `npx wrangler login`.
2. Create a D1 database: `npx wrangler d1 create nzs-analytics`.
3. Replace the placeholder `database_id` in `wrangler.toml` with the ID returned by Cloudflare.
4. Create two different random secrets, then run `npx wrangler secret put PURCHASE_TOKEN` and `npx wrangler secret put ADMIN_TOKEN`. Save a copy of the purchase token for the trusted purchase service.
5. Run `npm run db:migrate:remote`, then `npm run deploy`.

The placeholder database ID is intended only for local development. Do not deploy before replacing it.

## Connect Better Times

The extension currently creates `userId` in `browser.storage.sync`, but it does not send usage reports to this Worker. Add a daily report from the extension background script after `ensureUserId()` resolves. Send only the ID to `/v1/seen`, and add the deployed Worker origin to the extension's `host_permissions`. Do not send the `premium` value from extension storage as proof of purchase.

The current purchase flow uses a static Stripe link and restores by email. Neither gives this Worker a verified mapping from purchase to `userId`. Have your trusted purchase service verify a transaction, associate it with the UUID, then call `/v1/purchase` using `PURCHASE_TOKEN`. A server-created checkout session carrying the UUID, or an email-verified restore flow, can establish that association. Without it, usage metrics work, but purchase counts remain at zero.

Before enabling reports, disclose the persistent ID and usage reporting in the extension's privacy information and store listings. Consider rate limiting `/v1/seen` at Cloudflare to reduce spam.
