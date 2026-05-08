# Anson Milk Tea Shop - DVNA

## Overview
Milk Tea Shop vulnerable web app for OWASP Top 10 security training.

## Quick Start

```bash
cd anson-milktea
docker-compose up -d
```

Access at: **http://demo.zoskisk.com**

## Test Accounts

| Username | Password | Role | Balance |
|----------|----------|------|---------|
| admin | admin123 | admin | 99999 |
| user1 | password1 | user | 1000 |
| user2 | password2 | user | 500 |

## Vulnerabilities (DVNA)

- **A1 Injection**: Search page (SQLi)
- **A2 Broken Auth**: Login with plain-text compare
- **A3 XSS**: Reviews page (stored XSS)
- **A4 IDOR**: /user/account/:id - no ownership check
- **A5 Misconfiguration**: /vuln/config - hardcoded secrets
- **A6 Data Exposure**: /vuln/data - plaintext password column

## Secure Version

See `../deploy/` - secured version with:
- Parameterized queries
- bcrypt password hashing
- HTML escaping
- Auth middleware

## Traefik

Traefik reverse proxy configured at port 80/443.
Dashboard: http://demo.zoskisk.com:8080