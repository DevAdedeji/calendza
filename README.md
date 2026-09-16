# Calendza

Less back-and-forth, more time for the meeting. Share your booking page and let people choose a time that works with your availability.

[Try Calendza](https://calendza.xyz) · [Features](https://calendza.xyz/features) · [Pricing](https://calendza.xyz/pricing)

## Features

- **Flexible bookings:** personal booking pages, multiple durations, recurring meetings, group sessions, approvals and custom booking questions.
- **Availability controls:** time zones, buffers, away periods, date overrides and booking limits.
- **Calendar and video integrations:** Google Calendar, Microsoft Calendar, Apple Calendar, Google Meet, Microsoft Teams and Zoom.
- **Team scheduling:** round-robin and collective bookings, team roles and managed event templates.
- **Your own experience:** custom branding, guest emails, routing forms, workflows and website embeds.
- **Payments and insights:** paid bookings, personal and team subscriptions, analytics and attendance tracking.

## Try it out

Create an event type, set your available hours and open its booking link in a separate browser session. Make a booking, then reschedule or cancel it to see the full flow.

Use accounts and calendars you control. When checkout is marked as sandbox, use only test payment details. Emails, calendar invitations and video meetings can still be real.

## Built with

Nuxt 4, Vue, TypeScript, Nuxt UI, Tailwind CSS, PostgreSQL and Drizzle ORM. Better Auth handles sign-in and 2FA, Temporal handles time-zone calculations, and Bachs handles payments.

Email, workflow and calendar jobs are stored in PostgreSQL so they can be retried after a failure or server restart.

## Run locally

Requires Node.js 22.13+, pnpm 11+ and Docker.

```bash
pnpm install
cp .env.example .env
```

Set a random 32+ character `AUTH_SECRET` in `.env`. The template already points to the local database on port `5443`. See [.env.example](.env.example) for calendar and payment credentials.

```bash
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Open [localhost:3002](http://localhost:3002). Development emails are logged to the terminal instead of sent.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Database and browser tests require an isolated `TEST_DATABASE_URL` in `.env.test`. Tests can delete data, so never use staging or production.

## Security and license

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

Source is available for viewing and evaluation under a [proprietary license](LICENSE). Public visibility does not grant permission to reuse or redistribute the code.
