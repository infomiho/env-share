# env-share

Self-hosted encrypted `.env` sharing. End-to-end encrypted — the server cannot decrypt your secrets even with full database access.

## Deploy

1. Create a [GitHub OAuth App](https://github.com/settings/developers) (enable Device Flow)
2. Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

3. Start with Docker Compose:

```bash
docker compose up -d
```

## CLI Usage

```bash
# Authenticate
npx @infomiho/env-share login --server https://env.example.com

# Initialize a project
npx @infomiho/env-share init

# Push / pull .env files
npx @infomiho/env-share push
npx @infomiho/env-share pull

# Manage team members
npx @infomiho/env-share members add octocat
npx @infomiho/env-share members remove octocat
npx @infomiho/env-share members list
```

## How It Works

Each user has an X25519 keypair (private key stays local). Each project has a symmetric key encrypted per-member using ECIES. The server only stores encrypted blobs and wrapped keys — it can never decrypt anything.
