# @infomiho/env-share

CLI for [env-share](https://github.com/infomiho/env-share) — self-hosted encrypted `.env` sharing.

## Usage

```bash
# Authenticate with your server
npx @infomiho/env-share login --server https://env.example.com

# Initialize a project (run in your repo root)
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

Your private key never leaves your machine. Project secrets are encrypted with a symmetric key that's wrapped per-member using X25519 ECIES. The server only stores encrypted blobs — it can never decrypt anything.
