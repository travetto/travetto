import { CliCommand } from '@travetto/cli';

import { Repo } from './bin/repo';

type Options = {};

/**
 * `npx trv repo:dep-graph`
 *
 * Produces a dependency graph
 */
export class RepoDepGraphCommand extends CliCommand<Options> {

  name = 'repo:dep-graph';

  async action(...args: unknown[]): Promise<void> {
    const modules = await Repo.graphByFolder;
    const entries = Object.entries(modules)
      .flatMap(([k, v]) => [...v].map(x => [k, x]))
      .map(([src, dest]) => `"${dest}" -> "${src}";`);
    console.log(`digraph g {\n${entries.join('\n')}\n}\n`);
  }
}