# Calendza clean setup

This release uses **Calendza** and **https://calendza.xyz** exclusively. It is a fresh-start release, not an in-place data migration. There are no previous-brand environment aliases, embed aliases, or domain redirects.

## Databases and deployment

1. Provision separate, empty databases for staging and production. Keep existing databases as backups until you deliberately decide to remove them.
2. Set `DATABASE_URL` and, for a pooled connection, `DIRECT_URL` to the new database in **both web and worker services**. Do not reuse an existing database or copy its migration ledger.
3. Set `CALENDZA_URL=https://staging.calendza.xyz` on staging and `CALENDZA_URL=https://calendza.xyz` on production. Docker needs this value as a build argument as well as a runtime variable.
4. Set `CALENDZA_ENVIRONMENT` to `staging` or `production`, `CALENDZA_PROCESS_ROLE` to the service's `web` or `worker` role, and `CALENDZA_BILLING_MODE` to `sandbox` or `live`, matching its Bachs key. Keep portfolio demonstrations in sandbox mode.
5. Configure the required secrets from `.env.example`. Do not copy secrets into source control. Run `node scripts/migrate.mjs` before starting the app. Migration files and snapshots describe a fresh Calendza database; the runner rejects a mismatched migration history without changing it.
6. Create your account again. `PLATFORM_ADMIN_EMAILS` still controls administrator access. Recreate test teams, event types, subscriptions and bookings as needed.

Do not replay old jobs, webhooks or pending checkouts into the new database. Credentials, payment metadata, provider identifiers and queued payloads now use Calendza names. Previously encrypted integration credentials are not portable into this setup.

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

Update provider display names, homepage, privacy policy, terms and support links. Reconnect calendars and Zoom from the Integrations page. Apple Calendar still uses the user's app-specific password, not an OAuth client ID.

Verify the email domain before using `EMAIL_FROM=Calendza <hello@calendza.xyz>`, and make sure `support@calendza.xyz` reaches you. Provision DNS and TLS for the new domains. Updating this code does not change DNS, provider dashboards, GitHub settings, or cloud databases.

Update the site's display name and domain in Umami as well. Its website ID is separate from the product name and remains configured in `shared/analytics.ts`.

## Local development and testing

`docker compose up -d db` starts the separate `calendza-db` container on port **5443**, with its own volume. The app's normal local port remains **3002**. Copy `.env.example` to `.env` and migrate the new database before running the app.

Create an isolated `calendza_test` database and put its connection string in the ignored `.env.test` as `TEST_DATABASE_URL`. Run `node scripts/migrate.mjs --test` before the database and browser tests. Tests must never point at the normal app database.

Playwright sets `CALENDZA_E2E=1` automatically to keep its generated Nuxt files in `.cache/nuxt-e2e`, separate from the normal development server. Do not set this test-only switch on deployed services.

New embeds use `https://calendza.xyz/embed.js`, `data-calendza-*` attributes, the `CalendzaEmbed` API, and `calendza:*` browser events. Generate fresh snippets from the app.

## Verification before release

Run lint, type checks, the complete unit/database suite, browser tests and a production build. After deploying, confirm the new domain's homepage, signup, booking, embed, billing and integration callbacks. Provider connections and checkout require testing with the new HTTPS domains; local tests alone do not establish that these external settings work.
