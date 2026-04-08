# Company-Hub — Context für Claude

Kurzer Projekt-Kontext für neue Konversationen. Details immer aus dem Code lesen.

## Was ist das?
Modulare, multi-tenant HR- & Community-Plattform (SaaS) für deutsche Unternehmen. Fokus: Urlaub, Zeiterfassung, internes Social Feed. Repo: `lw-consulting/company-hub` (privat).

## Monorepo-Struktur
npm workspaces mit drei Paketen + mobile:
- `backend/` — Fastify 5 API (TypeScript, ESM)
- `frontend/` — React 19 + Vite 6 SPA
- `packages/shared/` — geteilte Types, Zod-Schemas, Constants, `MODULE_IDS`
- `mobile/` — React Native / Expo (separat)

## Tech-Stack
- **Backend:** Fastify 5, Drizzle ORM 0.38, PostgreSQL, JWT via `jose`, Argon2, Zod, Pino
- **Frontend:** React 19, TanStack Router + Query, Zustand, React Hook Form, Tailwind, Lucide, `react-easy-crop`
- **Node ≥ 20**, TypeScript 5.7

## Dev-Commands (vom Root)
```bash
npm run dev:backend        # tsx watch auf backend/src/index.ts
npm run dev:frontend       # vite dev
npm run build              # shared → backend → frontend (Reihenfolge wichtig!)
npm run lint               # eslint .
npm run typecheck          # tsc -b
npm run db:generate        # drizzle-kit generate (nach Schema-Änderung)
npm run db:migrate         # Migrations auf DB ausführen
npm run db:seed            # Seed-Daten inkl. Admin-User
```
Nach jedem Schema-Change im Backend: `db:generate` → `db:migrate`.

## Backend-Module (`backend/src/modules/`)
`auth, users, organizations, leave, time-tracking, community, tasks, calendar, notifications, files, integrations, crm, ai-assistants, courses`

Jedes Modul folgt dem Pattern: `routes.ts` + `service.ts` (+ ggf. `schemas.ts`). Auth läuft über Fastify-Plugin in `src/plugins/`.

## DB-Schema (`backend/src/db/schema/`)
Eine Datei pro Domäne: `users, organizations, leave, time-tracking, community, tasks, calendar, notifications, crm, ai-assistants, courses, integrations, file-uploads, user-module-permissions`. Export-Sammelstelle: `schema/index.ts`.

Multi-Tenancy: fast alles hat `orgId`. Bei neuen Queries immer nach `orgId` filtern.

## Frontend-Module (`frontend/src/modules/`)
`dashboard, community, tasks, calendar, leave, time-tracking, profile, auth, admin, ai-assistants, courses, crm` + `PlaceholderPage.tsx` für deaktivierte Module.

Modul-Registry/Aktivierung läuft über `MODULE_IDS` aus `packages/shared` + `user-module-permissions` Tabelle (pro User konfigurierbar).

## Konventionen & Gotchas (aus Commits gelernt)

- **`communityComments` nutzt `authorId`**, nicht `userId`. Ähnliche Inkonsistenzen: prüfe das Schema bevor du Feld-Namen annimmst.
- **`businessDays` ist `integer`** in Leave-Requests, nicht string. In Zod-Schemas und API-Payloads sauber casten.
- **`AppError`-Signatur** hat ein festes Format — beim Werfen an bestehende Aufrufe halten (siehe `backend/src/lib/errors.ts`).
- **Avatar/Media-URLs** werden im Frontend aufgelöst (Helper existiert). Backend speichert relative Pfade; `/uploads` wird von `@fastify/static` served.
- **Helmet CORP** steht auf `cross-origin`, damit Avatar-Bilder im Browser laden — nicht zurückdrehen.
- **Deutsche Arbeitszeit-Regeln:** Pausenregeln (`breakAfterMinutes`, `breakDurationMinutes`), Kernzeiten, `workingDays`, `vacationDaysPerYear`, `weeklyTargetHours` leben auf Org bzw. User. Feiertage in `publicHolidays` pro Org.
- **PWA aktiv** (Manifest + SW) — bei Frontend-Changes ggf. Cache-Invalidation bedenken.
- **Org-Branding:** `primaryColor/secondaryColor/accentColor/logoUrl/timezone/locale` stehen auf `organizations`. Frontend zieht das per API-Call beim Login.

## Sicherheit
- `secrets.txt` liegt im Root — **niemals committen oder lesen** außer explizit gefordert. `.env` gilt dasselbe.
- Passwörter nur mit Argon2.
- Env-Validierung läuft über Zod in `backend/src/config/env.ts`. Neue Env-Vars dort eintragen.
- JWT Access 15m / Refresh 7d (default).

## Style
- Commits: Conventional Commits, Sprache meist **Deutsch** (`feat: Umfragen im Feed`, `fix: …`). Passe dich dem Stil an.
- Kommunikation mit User auf Deutsch.
- Keine übereifrigen Refactors — nur das ändern, was gefragt ist.

## Nicht vorhanden (nicht suchen)
- Keine Tests (noch) — kein Test-Runner im `package.json`.
- Keine CI-Config dokumentiert außer `.github/`.
