import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eciesDecrypt, loadPrivateKey } from './crypto.js'

const CONFIG_DIR = path.join(os.homedir(), '.env-share')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')
const PROJECT_CONFIG_NAME = '.env-share.json'

export interface Config {
  serverUrl: string
  token: string
}

export interface ProjectConfig {
  projectId: string
}

export interface UserInfo {
  github_login: string
  public_key: string | null
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("Not logged in. Run 'env-share login' first.")
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
}

export function saveConfig(config: Config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
}

export function clearConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH)
  }
}

export function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME)
  if (!fs.existsSync(configPath)) {
    throw new Error("No project config found. Run 'env-share init' first.")
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

export function saveProjectConfig(config: ProjectConfig) {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export function getServerHost(serverUrl: string): string {
  return new URL(serverUrl).host.replace(/[^a-zA-Z0-9.-]/g, '_')
}

export async function apiRequest<T>(
  method: HttpMethod,
  urlPath: string,
  body?: unknown,
): Promise<T> {
  const config = loadConfig()
  const url = `${config.serverUrl}${urlPath}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
  }

  const init: RequestInit = { method, headers }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)

  if (!response.ok) {
    const text = await response.text()
    let message: string
    try {
      message = JSON.parse(text).error ?? text
    } catch {
      message = text
    }
    throw new Error(`API error (${response.status}): ${message}`)
  }

  return response.json() as Promise<T>
}

export async function unwrapProjectKey(projectId: string): Promise<Buffer> {
  const config = loadConfig()
  const serverHost = getServerHost(config.serverUrl)

  const { encryptedProjectKey } = await apiRequest<{ encryptedProjectKey: string }>(
    'GET',
    `/api/projects/${projectId}/key`,
  )

  const privateKey = loadPrivateKey(serverHost)
  return eciesDecrypt(encryptedProjectKey, privateKey)
}
