# NZS Analytics Worker

A TypeScript Cloudflare Worker and D1 database for tracking extension users by app. Each POST stores the latest `premium` value for an `(appId, userId)` pair, updates its first and last seen times, and records one activity row per UTC day. It does not store article URLs, browsing history, or email addresses.

## API

`POST /` (also available at `POST /v1/seen`) accepts JSON:

```json
{
  "appId": "com.nazariosoftware.Better-Times",
  "userId": "d8564f92-9c5b-4b50-b151-4540c533ef2e",
  "premium": false
}
```

All three properties are required. `appId` and `userId` must be nonempty strings of at most 128 characters; `premium` must be a boolean. A valid request returns `204 No Content`. Repeated posts update the existing row rather than creating another user.

`GET /v1/metrics?appId=<appId>` returns `uniqueUsers`, `premiumUsers`, `activeUsers30d`, and `activeUsersToday` for that app. This endpoint is public.

The public POST endpoint accepts client-reported data. The `premium` value is useful for analytics but **is not proof of purchase**. It must not be used to grant access. Public requests can also be spoofed, so the counts are estimates; consider Cloudflare rate limiting.

## Run locally

```sh
npm install
npm run db:migrate:local
npm run dev
```

The local Worker runs at `http://localhost:8787` by default. Run `npm run typecheck` to check the TypeScript source.

## Deploy

1. Authenticate Wrangler: `npx wrangler login`.
2. Create a D1 database: `npx wrangler d1 create nzs-analytics`.
3. Replace the placeholder `database_id` in `wrangler.toml` with the ID returned by Cloudflare.
4. Run `npm run db:migrate:remote`, then `npm run deploy`.

The placeholder database ID is only for local development. Do not deploy before replacing it.

## Connect an extension

Send one POST from the extension background script after obtaining its synced `userId`, and add the deployed Worker origin to the extension's `host_permissions`. Send the app's bundle ID as `appId` and the current cached purchase flag as `premium`. A daily report is enough for daily active user counts. Before enabling reporting, disclose the persistent ID and usage reporting in the extension's privacy information and store listings.
