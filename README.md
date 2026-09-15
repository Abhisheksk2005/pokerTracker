# PKRTrackr

A local-first poker league tracker built with Next.js 16, React 19, Prisma 7 and SQLite. Games, player analytics, standings and the money ledger are isolated by poker group while player profiles can belong to more than one group.

## Getting started

Install dependencies, apply the database migrations, and start the development server:

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No demo seed is included. Player profiles, games and transactions exist only when you add them through the app. Group selection is stored in an HTTP-only browser cookie and scopes all reads and writes.

## Group workflow

- Open **Groups** from the circular **+** control in the top-right corner.
- Create the first group by choosing an existing owner profile or entering a new profile name, plus an optional description and accent.
- Share the generated invite code. In this account-free local app, joining means attaching an existing player profile to that group.
- Owners are fixed; other members can be promoted to Admin or returned to Member.
- Switching the active group immediately scopes the dashboard, nights, roster, statistics and ledger.

## Checks

```bash
npm run check      # lint + typecheck + tests + production build
```

`npm test` runs isolated SQLite integration tests (game bank) and unit tests (passcode sessions, redirect safety). Tests never touch the app database.

## Live game workflow

1. Select a group on Home, then choose **Start a game**.
2. Select saved players or add names. New profiles and group memberships are saved atomically when the game starts.
3. Enter the initial buy-in for each player. Check **Initial cash already collected** only for money actually received. Initial buy-ins remain locked during play; any unpaid opening amount is included in final settlement.
4. Use **Buy-in** for extra chips. **Clear buy-in** records all or part of an extra payment without removing the buy-in from results.
5. Use **Recycle chips** when a player returns chips without cash. Optionally issue the same chips directly to another player as a new buy-in. The bank's debt to the lender stays outstanding until payment or an explicit credit offset is recorded.
6. Return all remaining chips using **Cash-out**, finish the game, then record each player's final net settlement. Only actual cash movements enter the ledger; credit offsets do not invent cash.

The optional physical chip supply prevents issuing chips the bank does not have. The bank also rejects payouts exceeding collected cash, duplicate/stale submissions, and actions from a different selected group. Corrections undo a whole linked action and retain its audit trail. Initial buy-ins cannot be undone.

Existing games remain in their original editor until **Use live bank for this game** is selected. Conversion preserves entries and ledger payments; existing aggregate buy-ins become locked opening totals because their original/extra split was never recorded separately. The previous dashboard remains available under **League pulse & highlights**.

Run `npm test` for isolated SQLite integration tests of setup, locked initial amounts, partial clearing, recycling, inventory and cash limits, corrections, legacy conversion, late arrivals and final settlement. Tests never write to the app database.

## Production

The UI follows the *Poker Table iOS* design: a dark, phone-first app with a bottom tab bar. It installs to an iPhone or Android home screen (Share → Add to Home Screen) with its own icon, and respects the notch and home indicator.

### Access control

There are no accounts: a group shares one passcode.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_PASSCODE` | **Yes, in production** | Passcode typed on the unlock screen. Without it a production build shows a setup screen and serves no data. Use something long (a few random words): on serverless hosts the wrong-guess throttle resets whenever a new instance starts. |
| `AUTH_SECRET` | Recommended | Long random string that signs the 30-day session cookie. Changing it, or the passcode, signs every device out. |
| `DATABASE_URL` | Yes | `libsql://…` for Turso, or `file:…` for a local/Docker SQLite file. |
| `DATABASE_AUTH_TOKEN` | For Turso | Token for the Turso database. |
| `ALLOW_OPEN_ACCESS` | No | `true` runs production with no passcode. Trusted private networks only. |
| `INSECURE_COOKIES` | No | `true` only when serving production over plain HTTP. |

Copy `.env.example` to get started. The gate covers every page and every save (writes without a session get `401`), and **Lock app** in the **+** menu signs the current device out. Local `npm run dev` stays open when no passcode is set.

### Deploy free: Vercel + Turso (recommended)

The app talks to its database through libSQL, so the same code runs on a local SQLite file and on [Turso](https://turso.tech), a hosted SQLite-compatible database. Data lives in Turso and survives every redeploy.

1. **Turso:** sign up, create a database (e.g. `pkrtrackr`), then copy its **URL** (`libsql://…`) and create an **auth token**. Both are in the dashboard, or via the CLI: `turso db show pkrtrackr --url` and `turso db tokens create pkrtrackr`.
2. **GitHub:** push this project to a repository. The local database, backups and `.env` are git-ignored, so no data is uploaded.
3. **Vercel:** *Add New → Project*, import the repo (the Next.js preset is detected), and under **Environment Variables** add `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSCODE` and `AUTH_SECRET`. Then deploy.

Vercel runs the `vercel-build` script, which applies any pending migrations to Turso before building, so the tables are created on the first deploy and updated on later ones. Every `git push` redeploys. Open the `https://….vercel.app` link on your phone and add it to your home screen.

`GET /api/health` returns `200` when the app and database are reachable.

### Backups

```bash
npm run db:backup
```

- With `DATABASE_URL` pointing at **Turso** (plus its token), this downloads a full `.sql` dump to `./backups`. Restore it into a fresh database with `turso db shell <database> < backups/<file>.sql`.
- With a **local file**, it writes a consistent `.db` snapshot (safe while the app runs) and verifies it with `integrity_check`. `BACKUP_FORMAT=sql` produces a portable dump instead.

`BACKUP_DIR` / `BACKUP_KEEP` (default 14) control location and retention.

### Alternative: your own server or Docker

```bash
npm ci && npm run build
APP_PASSCODE=... AUTH_SECRET=... DATABASE_URL=file:/var/lib/pkrtrackr/pkrtrackr.db npm run start:prod
```

```bash
docker build -t pkrtrackr .
docker run -d --name pkrtrackr -p 3000:3000 -v pkrtrackr-data:/data   -e APP_PASSCODE=... -e AUTH_SECRET=... pkrtrackr
```

`start:prod` and the container apply pending migrations (`npm run db:migrate`) and then start the app. With a local file, run a single instance on persistent disk behind HTTPS.

### Hardening already in place

- Security headers: `X-Frame-Options`, `frame-ancestors 'none'`, HSTS in production, `nosniff`, referrer and permissions policies. `X-Powered-By` is off.
- Local SQLite files run in WAL mode with a 5 s busy timeout, so reads continue during writes.
- Friendly 404, error and loading screens. Server error details never reach the browser, only a reference id.
- Search engines are told not to index the app.
