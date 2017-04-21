import { git, envForAuthentication, expectedAuthenticationErrors, GitError, IGitExecutionOptions } from './core'
import { Repository } from '../../models/repository'
import { Account } from '../../models/account'
import { ChildProcess } from 'child_process'
import { PullProgressParser } from '../progress'
import { IPullProgress } from '../app-state'

const byline = require('byline')

/** Pull from the remote to the branch. */
export async function pull(repository: Repository, account: Account | null, remote: string, progressCallback?: (progress: IPullProgress) => void): Promise<void> {

  let options: IGitExecutionOptions = {
    env: envForAuthentication(account),
    expectedErrors: expectedAuthenticationErrors(),
  }

  if (progressCallback) {
    const title = `Pulling ${remote}`
    const kind = 'pull'

    options = {
      ...options,
      processCallback: (process: ChildProcess) => {
        const parser = new PullProgressParser()
        byline(process.stderr).on('data', (line: string) => {
          const progress = parser.parse(line)

          // In addition to progress output from the remote end and from
          // git itself, the stderr output from pull contains information
          // about ref updates. We don't need to bring those into the progress
          // stream so we'll just punt on anything we don't know about for now. 
          if (progress.kind === 'context') {
            if (!progress.text.startsWith('remote: Counting objects')) {
              return
            }
          }

          progressCallback({
            kind,
            title,
            description: progress.kind === 'progress'
              ? progress.details.text
              : progress.text,
            value: progress.percent,
            remote,
          })
        })
      },
    }

    progressCallback({ kind, title, value: 0, remote })
  }

  const args = progressCallback
    ? [ 'pull', '--progress', remote ]
    : [ 'pull', remote ]

  const result = await git(args, repository.path, 'pull', options)

  if (result.gitErrorDescription) {
    throw new GitError(result, args)
  }
}
