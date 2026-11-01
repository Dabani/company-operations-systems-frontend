<div align="center">

# COPS Web

**Company Operations Platform - frontend (installable PWA)**

A responsive, multilingual dashboard for service desk, controlled files, IT infrastructure, archive and records, and compliance.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)
![License](https://img.shields.io/badge/license-MIT-green)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-3773b8)

[Backend repository](https://github.com/Dabani/company-operation-system) · [Report a bug](https://github.com/Dabani/company-operations-systems-frontend/issues) · [Request a feature](https://github.com/Dabani/company-operations-systems-frontend/issues)

</div>

---

<!-- Add screenshots here: dashboard, cases, reports, mobile view.
![Dashboard](docs/screenshots/dashboard.png) -->

## What is COPS?

**COPS** (Company Operations Platform) brings an organization's support requests, files, IT equipment, paper archive and compliance duties into one auditable system, with a dashboard adapted to each person's role.
This repository is the **web application**; the REST API is in [cops-api](https://github.com/Dabani/company-operation-system).

## Features

- **Role-based experience** - every role (guest, staff, team leader, manager, admin, or your own) gets its own dashboard and only the menu entries it is allowed to use. Three-level accordion menu.
- **Service desk** - create and follow cases with unique references, comment with rich text, live chat with a support bot, instant notifications.
- **Controlled files** - upload, preview, download, archive, restore and request deletion according to permissions.
- **IT infrastructure** - assets, movements, access register, incidents.
- **Archive and records** - records register, retention rules, legal references, physical access, inventory counts, disposal with printable certificates.
- **Compliance** - duties calendar, backup verification, training attendance, audits and findings, management reports.
- **Reports with charts** - seven cross-module reports, period selector, CSV/Excel export, print, and a "how is this calculated?" panel.
- **User management** - invitations by e-mail, activation page with live password rules, bulk actions, details drawer with recent activity.
- **Powerful lists** - search, filters, sorting, pagination, export, import and print on every list.
- **Rich text everywhere** - Tiptap editor on all text areas, sanitized before display.
- **Multilingual** - English, French, Kinyarwanda and Swahili; a language switcher in the header.
- **Installable PWA** - works offline for already-loaded screens, update prompt, never queues writes silently.
- **Responsive and accessible** - designed from 360 px phones up; Verdana brand typography, blue `#3773b8` and green `#1c9d67`.

## Tech stack

React 19 · TypeScript · Vite · Mantine 9 (+ Charts, Tiptap, Dropzone, Notifications) · TanStack Query · React Router · i18next · Laravel Echo (WebSockets) · vite-plugin-pwa · Vitest.

## Getting started

### Requirements

Node.js 24 and npm, plus the running API ([cops-api](https://github.com/Dabani/company-operation-system)).

### Install and run

```bash
git clone https://github.com/Dabani/company-operations-systems-frontend.git
cd cops-web
npm ci
cp .env.example .env        # real-time keys (see below)
npm run dev                 # http://localhost:5173
```

In development Vite proxies `/api` to `http://localhost:8000`, so start the API first and keep both on `localhost` (cookie authentication needs the same site).

### Environment

| Variable | Purpose |
|---|---|
| `VITE_REVERB_APP_KEY` | Public key of the WebSocket server (same value as `REVERB_APP_KEY` in the API; never the secret) |
| `VITE_REVERB_HOST` / `VITE_REVERB_PORT` / `VITE_REVERB_SCHEME` | Where the browser reaches the WebSocket server |

Without these, the application works; live chat and instant notifications fall back to normal refreshes.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run build:check` | Build, then fail if the first-load JavaScript exceeds the budget (400 KB gzipped) |

### Using the application

1. Sign in with the administrator created by the API seeder (or accept the activation e-mail you were sent and choose your password).
2. Use the side menu - what you see depends on your role. The **Dashboard** summarizes what needs your attention.
3. Every list supports search, filters, sorting and export; click a row to open details.
4. Open **Reports** (managers and above) to see charts and download the figures.
5. Install it as an app from the browser menu ("Install" / "Add to home screen").

## Project layout

```
src/pages         one file per screen (lazy-loaded, one chunk each)
src/components    shared building blocks (DataList, RichTextField, StatusBadge ...)
src/auth          session and permission helpers
src/api           HTTP client (CSRF, error mapping, offline handling)
src/i18n          translations: en, fr, rw, sw
src/lib           helpers (formatting, icons, lookups, password rules)
```

Two conventions to know before you change something: lists of choices always come from the API's lookup tables (never hard-coded), and every user-facing string goes through `t('...')` in **all four** languages.

## Deployment

Build with `npm run build:check` and serve `dist/` from the same host name as the API (Nginx example, security headers and release script are in the API repository under `deploy/`).

## Contributing

Contributions are very welcome - this is a broad platform and there is room for everyone: front-end developers, designers, accessibility reviewers, translators and testers.

1. Browse the [open issues](https://github.com/Dabani/company-operations-systems-frontend/issues) (`good first issue`, `help wanted`) or open one to discuss an idea.
2. Fork, branch (`feature/short-name`), and make your change.
3. Before opening a pull request: `npm run typecheck && npm test && npm run build:check`.
4. Describe what changed and why; include screenshots for visual changes (phone and desktop).

Guidelines: keep screens responsive down to 360 px, keep forms keyboard-accessible, reuse `DataList` and the shared components, translate every string in all four languages, and keep heavy libraries out of the first load (screens are lazy-loaded for that reason). Please read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

### Where help is most valuable

- Native review of **Kinyarwanda** and **Swahili**, and new languages.
- Accessibility audit (screen readers, contrast, keyboard) and visual polish.
- End-to-end tests (Playwright) for the main journeys.
- Real-world feedback from the field.

## Roadmap

- [ ] End-to-end test suite and visual regression tests
- [ ] Two-factor authentication screens (with the API)
- [ ] Manual light/dark switch and dark-theme polish (the app follows the system setting today)
- [ ] Web push notifications
- [ ] Dashboard builder: let administrators arrange widgets per role
- [ ] Report scheduling and saved report filters
- [ ] Offline reading cache for selected screens (explicitly opt-in, no silent queued writes)
- [ ] In-app guided tour and contextual help
- [ ] Storybook for shared components
- [ ] Additional languages

Missing something? [Open an issue](https://github.com/Dabani/company-operations-systems-frontend/issues) and tell us your use case.

## Project status

The application is feature-rich and under active development. Kinyarwanda and Swahili texts are first-pass translations awaiting native review.

## License

Released under the [MIT License](LICENSE).

## Acknowledgements

Built with [React](https://react.dev), [Mantine](https://mantine.dev), [TanStack Query](https://tanstack.com/query), [i18next](https://www.i18next.com) and the open-source community.
