# Calendza deployment

The app uses **Calendza** and **https://calendza.xyz**. Keep the existing Neon databases already configured in Railway. There are no old-domain redirects or public embed aliases.

## Databases and deployment

1. Keep the current staging and production Neon databases. Do not reset them or create replacement databases for this release.
2. Leave `DATABASE_URL` and `DIRECT_URL` unchanged in Railway. Keep `AUTH_SECRET` and `INTEGRATION_ENCRYPTION_KEY` unchanged so existing encrypted records remain readable.
3. Set `CALENDZA_URL=https://staging.calendza.xyz` on staging and `CALENDZA_URL=https://calendza.xyz` on production. Docker needs this value as a build argument as well as a runtime variable.
4. Set `CALENDZA_ENVIRONMENT` to `staging` or `production` and keep the current process role in `CALENDZA_PROCESS_ROLE`. Both environments remain in sandbox payment mode: use `CALENDZA_BILLING_MODE=sandbox` with the existing sandbox Bachs key and matching webhook secret.
5. Run `node scripts/migrate.mjs` before starting the app, as Railway's pre-deploy command already does. Applied migrations and physical column names are preserved, so existing databases do not need a rebrand schema migration.
6. Existing accounts, teams, event types and bookings remain. Sign in again on the new domain because browsers do not transfer login cookies between domains.

Historical migrations, encryption namespaces and provider idempotency identifiers retain their original internal names. These are data formats, not display branding: changing them would break saved credentials or repeat existing provider operations. New UI copy, emails and public URLs use Calendza. Previously sent emails cannot be edited; resend links from the app if needed. Do not roll back to a version with different credential encryption settings.

## Provider dashboards

Configure these production URLs, and use `staging.calendza.xyz` for staging integrations:

| Provider setting | Production value |
| --- | --- |
| Google authorized JavaScript origin | `https://calendza.xyz` |
| Google sign-in callback | `https://calendza.xyz/api/auth/callback/google` |
| Google Calendar callback | `https://calendza.xyz/api/integrations/google-calendar/callback` |
| Microsoft Calendar callback | `https://calendza.xyz/api/integrations/microsoft-calendar/callback` |
| Zoom OAuth callback | `https://calendza.xyz/api/integrations/zoom/callback` |
| Zoom webhook | `https://calendza.xyz/api/webhooks/zoom` |
| Bachs webhook | `https://calendza.xyz/api/webhooks/bachs` |

Update provider display names, homepage, privacy policy, terms and support links. Existing encrypted calendar credentials remain readable. Reauthorize a provider if it requests consent after its callback settings change. Apple Calendar still uses the user's app-specific password, not an OAuth client ID. Enable connected-account event sources on the Bachs sandbox webhook as well as platform events.

Verify the email domain before using `EMAIL_FROM=Calendza <hello@calendza.xyz>`, and make sure `support@calendza.xyz` reaches you. Provision DNS and TLS for the new domains. Updating this code does not change DNS, provider dashboards, GitHub settings, or cloud databases.

Update the site's display name and domain in Umami as well. Its website ID is separate from the product name and remains configured in `shared/analytics.ts`.

## Local development and testing

`docker compose up -d db` starts the separate `calendza-db` container on port **5443**, with its own volume. The app's normal local port remains **3002**. Copy `.env.example` to `.env` and migrate the new database before running the app.

Create an isolated `calendza_test` database and put its connection string in the ignored `.env.test` as `TEST_DATABASE_URL`. Run `node scripts/migrate.mjs --test` before the database and browser tests. Tests must never point at the normal app database.

Playwright sets `CALENDZA_E2E=1` automatically to keep its generated Nuxt files in `.cache/nuxt-e2e`, separate from the normal development server. Do not set this test-only switch on deployed services.

New embeds use `https://calendza.xyz/embed.js`, `data-calendza-*` attributes, the `CalendzaEmbed` API, and `calendza:*` browser events. Generate fresh snippets from the app.

## Verification before release

Run lint, type checks, the complete unit/database suite, browser tests and a production build. After deploying, confirm the new domain's homepage, signup, booking, embed, billing and integration callbacks. Provider connections and checkout require testing with the new HTTPS domains; local tests alone do not establish that these external settings work.
