import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      github_id integer UNIQUE NOT NULL,
      github_login text NOT NULL,
      github_name text,
      public_key text
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id integer REFERENCES users(id),
      expires_at timestamptz NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY,
      name text NOT NULL,
      created_by integer REFERENCES users(id),
      created_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id text REFERENCES projects(id),
      user_id integer REFERENCES users(id),
      encrypted_project_key text NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id serial PRIMARY KEY,
      project_id text REFERENCES projects(id),
      name text NOT NULL,
      encrypted_content text NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  `;
}

export { sql };
