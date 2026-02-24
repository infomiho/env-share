# env-share

Self-hosted encrypted `.env` sharing with GitHub auth. End-to-end encrypted — the server cannot decrypt secrets.

## Project Structure

```
env-share/
├── server/                  # Node.js server (Hono)
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── db.ts            # PostgreSQL schema + queries
│   │   ├── middleware.ts     # Auth, membership checks
│   │   ├── schemas.ts       # Valibot request validation
│   │   └── routes/
│   │       ├── auth.ts      # GitHub device flow + public key upload
│   │       ├── projects.ts  # CRUD + membership + wrapped keys
│   │       └── files.ts     # Encrypted blob storage
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── tsdown.config.ts
├── cli/                     # TypeScript CLI
│   └── src/
│       ├── cli.ts           # Entry point
│       ├── lib.ts           # Config, API client
│       ├── crypto.ts        # X25519, ECIES, AES-256-GCM
│       └── commands/
│           ├── auth.ts      # login/logout/whoami
│           ├── init.ts      # Create project
│           ├── push.ts      # Encrypt + upload
│           ├── pull.ts      # Download + decrypt
│           └── members.ts   # Add/remove/list
└── docker-compose.yml
```

## Server

Node.js with Hono and PostgreSQL (via postgres.js). Uses tsdown for builds.

Run with Docker Compose:
```bash
cp .env.example .env  # fill in values
docker compose up
```

Environment variables: `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

## CLI

TypeScript with Commander.js. Published as `@infomiho/env-share`.

Build:
```bash
cd cli
npm install
npm run build
```

Link globally for development:
```bash
npm link
```

Commands: `login`, `logout`, `whoami`, `init`, `push`, `pull`, `members add/remove/list`

Config stored at `~/.env-share/config.json`. Private keys at `~/.env-share/keys/`. Per-project config in `.env-share.json`.

## Encryption

X25519 keypairs per user (private key stays local). Each project has a symmetric key (AES-256-GCM) wrapped per-member using ECIES. The server only stores encrypted blobs and wrapped keys.

## Deployment

Docker Compose with PostgreSQL 18. Requires a GitHub OAuth App with Device Flow enabled.

## Releasing

Automated via Release Please. Push commits to `main` using conventional format:

- `fix: description` → patch bump
- `feat: description` → minor bump
- `feat!: description` → major bump

Bot creates a release PR. Merging it triggers npm publish via OIDC trusted publishing.
