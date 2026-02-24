import { Command } from 'commander'
import fs from 'node:fs'
import path from 'node:path'
import { apiRequest, loadProjectConfig, unwrapProjectKey } from '../lib.js'
import { aesDecrypt } from '../crypto.js'

export const pullCommand = new Command('pull')
  .description('Download and decrypt an env file')
  .argument('[file]', 'File to pull', '.env')
  .action(async (file: string) => {
    const { projectId } = loadProjectConfig()
    const projectKey = await unwrapProjectKey(projectId)

    const fileName = path.basename(file)
    const { encryptedContent } = await apiRequest<{ encryptedContent: string }>(
      'GET',
      `/api/projects/${projectId}/files/${fileName}`,
    )

    const decrypted = aesDecrypt(encryptedContent, projectKey)
    fs.writeFileSync(path.resolve(file), decrypted)

    console.log(`Pulled ${fileName}.`)
  })
