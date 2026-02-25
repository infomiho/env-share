import { sql } from "./db.js";

export async function createProjectWithMember(
  id: string,
  name: string,
  userId: number,
  encryptedProjectKey: string,
) {
  await sql.begin(async (sql) => {
    await sql`INSERT INTO projects (id, name, created_by) VALUES (${id}, ${name}, ${userId})`;
    await sql`INSERT INTO project_members (project_id, user_id, encrypted_project_key)
              VALUES (${id}, ${userId}, ${encryptedProjectKey})`;
  });
}

export async function findProject(id: string) {
  const [project] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return project ?? null;
}

export async function findMemberKey(projectId: string, userId: number) {
  const [member] = await sql`
    SELECT encrypted_project_key FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${userId}`;
  return member?.encrypted_project_key ?? null;
}

export async function findUserByLogin(username: string) {
  const [user] =
    await sql`SELECT id, public_key FROM users WHERE github_login = ${username}`;
  return user ?? null;
}

export async function upsertMember(
  projectId: string,
  userId: number,
  encryptedProjectKey: string | null,
) {
  await sql`
    INSERT INTO project_members (project_id, user_id, encrypted_project_key)
    VALUES (${projectId}, ${userId}, ${encryptedProjectKey})
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      encrypted_project_key = EXCLUDED.encrypted_project_key`;
}

export async function removeMember(projectId: string, userId: number) {
  await sql`DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}`;
}

export async function listMembers(projectId: string) {
  return sql`
    SELECT u.github_login, u.github_name,
           (pm.encrypted_project_key IS NULL) AS pending
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId}`;
}

export async function isMember(projectId: string, userId: number) {
  const [row] =
    await sql`SELECT 1 FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId} AND encrypted_project_key IS NOT NULL`;
  return !!row;
}

export async function listPendingMembers(projectId: string) {
  return sql`
    SELECT u.id AS user_id, u.github_login, u.public_key
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId} AND pm.encrypted_project_key IS NULL AND u.public_key IS NOT NULL`;
}

export async function resolvePendingMembers(
  projectId: string,
  members: { userId: number; encryptedProjectKey: string }[],
) {
  await sql.begin(async (sql) => {
    for (const { userId, encryptedProjectKey } of members) {
      await sql`
        UPDATE project_members SET encrypted_project_key = ${encryptedProjectKey}
        WHERE project_id = ${projectId} AND user_id = ${userId} AND encrypted_project_key IS NULL`;
    }
  });
}

export async function isOwner(projectId: string, userId: number) {
  const [row] =
    await sql`SELECT 1 FROM projects WHERE id = ${projectId} AND created_by = ${userId}`;
  return !!row;
}

export async function insertFile(
  projectId: string,
  name: string,
  encryptedContent: string,
) {
  await sql`INSERT INTO files (project_id, name, encrypted_content) VALUES (${projectId}, ${name}, ${encryptedContent})`;
}

export async function getLatestFile(projectId: string, name: string) {
  const [file] = await sql`
    SELECT encrypted_content FROM files
    WHERE project_id = ${projectId} AND name = ${name}
    ORDER BY id DESC LIMIT 1`;
  return file ?? null;
}

export async function getFileHistory(projectId: string, name: string) {
  return sql`
    SELECT id, created_at FROM files
    WHERE project_id = ${projectId} AND name = ${name}
    ORDER BY id DESC`;
}

export async function deleteFile(projectId: string, name: string) {
  const [deleted] = await sql`
    DELETE FROM files WHERE project_id = ${projectId} AND name = ${name} RETURNING id`;
  return !!deleted;
}

export async function listFiles(projectId: string) {
  return sql`
    SELECT DISTINCT ON (name) name, created_at FROM files
    WHERE project_id = ${projectId} ORDER BY name, id DESC`;
}
