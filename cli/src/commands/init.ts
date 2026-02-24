import { Command } from 'commander'
import path from 'node:path'
import { apiRequest, saveProjectConfig, createSpinner, type UserInfo } from '../lib.js'
import { generateProjectKey, eciesEncrypt } from '../crypto.js'

export const initCommand = new Command('init')
  .description('Initialize a new project in the current directory')
  .action(async () => {
    const me = await apiRequest<UserInfo>('GET', '/api/auth/me')
    if (!me.public_key) {
      throw new Error("No public key on server. Run 'env-share login' again.")
    }

    const projectKey = generateProjectKey()
    const encryptedProjectKey = eciesEncrypt(projectKey, Buffer.from(me.public_key, 'base64'))
    const projectName = path.basename(process.cwd())

    const spinner = createSpinner('Creating project')
    spinner.start()

    const project = await apiRequest<{ id: string }>('POST', '/api/projects', {
      name: projectName,
      encryptedProjectKey,
    })

    saveProjectConfig({ projectId: project.id })

    spinner.stop(`✓ Project "${projectName}" created (${project.id}).`)
  })
