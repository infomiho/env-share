import { Command } from 'commander'
import { apiRequest, loadProjectConfig, unwrapProjectKey, createSpinner } from '../lib.js'
import { eciesEncrypt } from '../crypto.js'

interface Member {
  github_login: string
  github_name: string | null
}

const addCommand = new Command('add')
  .description('Add a member to the project')
  .argument('<username>', 'GitHub username to add')
  .action(async (username: string) => {
    const { projectId } = loadProjectConfig()
    const projectKey = await unwrapProjectKey(projectId)

    const { publicKey } = await apiRequest<{ publicKey: string }>(
      'GET',
      `/api/projects/${projectId}/members/${username}/public-key`,
    )

    const encryptedProjectKey = eciesEncrypt(projectKey, Buffer.from(publicKey, 'base64'))

    const spinner = createSpinner(`Adding ${username}`)
    spinner.start()

    await apiRequest('POST', `/api/projects/${projectId}/members`, {
      username,
      encryptedProjectKey,
    })

    spinner.stop(`✓ Added ${username} to the project.`)
  })

const removeCommand = new Command('remove')
  .description('Remove a member from the project')
  .argument('<username>', 'GitHub username to remove')
  .action(async (username: string) => {
    const { projectId } = loadProjectConfig()

    const spinner = createSpinner(`Removing ${username}`)
    spinner.start()

    await apiRequest('DELETE', `/api/projects/${projectId}/members/${username}`)

    spinner.stop(`✓ Removed ${username} from the project.`)
  })

const listCommand = new Command('list')
  .description('List project members')
  .action(async () => {
    const { projectId } = loadProjectConfig()
    const members = await apiRequest<Member[]>('GET', `/api/projects/${projectId}/members`)

    for (const member of members) {
      const name = member.github_name ? ` (${member.github_name})` : ''
      console.log(`${member.github_login}${name}`)
    }
    console.log(`\n${members.length} member${members.length === 1 ? '' : 's'}`)
  })

export const membersCommand = new Command('members')
  .description('Manage project members')

membersCommand.addCommand(addCommand)
membersCommand.addCommand(removeCommand)
membersCommand.addCommand(listCommand)
