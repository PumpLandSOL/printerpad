# GoodTek.fun

**The tech launchpad on Solana.** pump.fun launches memes — GoodTek launches *builders*.
Every project must ship a **live website** and a **public GitHub repo**, verified on spawn,
or it doesn't list. Each gets a 0–100 **Tech Score**; the board ranks tech, not hype.

Dependency-free — Node `http` + global `fetch`, vanilla-JS front-end.

## Run

```bash
npm start            # → http://localhost:8095
```

## The gate (M1)

`POST /api/spawn` with `{ name, ticker, desc, website, github, ca? }`:
- **website** must return `200` (server pings it)
- **github** must be a public repo (verified via the GitHub API)
- both are **mandatory** — fail either and it's gated, not listed

Tech Score = live site (35) + public repo (35) + commits in last 90d (15) +
description/language (10) + repo links its site (5).

Endpoints: `POST /api/spawn`, `POST /api/preview` (dry-run verify), `GET /api/projects`,
`POST /api/vote`.

## Env vars

| Var | Purpose |
|-----|---------|
| `PORT` | server port (default 8095) |
| `DATA_PATH` | registry file — set to a Railway Volume path to persist |
| `GH_TOKEN` | optional GitHub token to lift the API rate limit |
| `TEK_MINT` | $TEK mint (for later holder perks) |

## Roadmap

- **M1 (this):** launchpad board + the website/GitHub verification gate + Tech Score.
- **M2:** AI co-builder (Claude generates name/brand/site + scaffolds a starter repo) + `$TEK`
  spend/burn to spawn + holder perks.
- **M3:** real on-chain token mint + auto-deploy of generated projects + polish/deploy.
