import { RepoExecCommand } from './cli.repo_exec';

export class RepoSubCommand extends RepoExecCommand {
  name = 'repo:sub';
  baseArgs = ['trv'];
}