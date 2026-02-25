# @infomiho/env-share

CLI for [env-share](https://github.com/infomiho/env-share) — self-hosted encrypted `.env` sharing.

## Usage

```bash
# Authenticate with your server
npx @infomiho/env-share login --server https://env.example.com

# Initialize a project (run in your repo root)
npx @infomiho/env-share init --server https://env.example.com

# Push / pull .env files
npx @infomiho/env-share push
npx @infomiho/env-share pull

# Manage files
npx @infomiho/env-share files list
npx @infomiho/env-share files history .env
npx @infomiho/env-share files delete .env.old

# Manage team members
npx @infomiho/env-share members add octocat
npx @infomiho/env-share members remove octocat
npx @infomiho/env-share members list

# Check auth status (uses project's server, or --server flag)
npx @infomiho/env-share whoami
npx @infomiho/env-share whoami --server https://env.example.com
```

## How It Works

Your private key never leaves your machine. Project secrets are encrypted with a symmetric key that's wrapped per-member using X25519 ECIES. The server only stores encrypted blobs — it can never decrypt anything.
