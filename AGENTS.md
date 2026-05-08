# Anson Milk Tea Shop — DVNA

Security training app illustrating OWASP Top 10 vulnerabilities. The `../deploy/` directory contains the secured counterpart.

## Run

```bash
npm start        # production
npm run dev      # development with nodemon
```

Server starts on port 3000 (or `PORT` env var). SQLite DB (`data.db`) is auto-created on first run.

## Test Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| user1 | password1 | user |
| user2 | password2 | user |

## Project Structure

- `server.js` — entrypoint, DB init, inline API routes (`/api/*`, `/debug`)
- `routes/` — auth.js, user.js, admin.js, vuln.js
- `views/` — EJS templates organized by route prefix

## Architecture

- Express + ejs + sqlite3
- Session auth with hardcoded secret `devsecret` (intentional vulnerability)
- DB schema auto-created in `server.js:27-121`
- Routes mounted: `/` (auth), `/user`, `/admin`, `/vuln`

## Key Files for Vulnerability Context

- `SCENARIOS.md` — detailed Vietnamese exploitation walkthroughs for all vulns
- `routes/vuln.js` — vulnerability lab endpoints
- `routes/auth.js` — auth logic with plain-text password compare and predictable reset tokens
- `routes/user.js:214` — search SQLi; `routes/user.js:122` — IDOR

## Docker

```bash
docker-compose up -d
```

Deploys to Traefik-managed host `demo-milktea.zoskisk.com`. Traefik dashboard at port 8080.

## Notes

- This is a deliberately vulnerable app. Do not deploy to production environments.
- The `../deploy/` sibling directory contains the hardened version for comparison.
