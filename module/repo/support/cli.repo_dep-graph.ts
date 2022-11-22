import { CliCommand } from '@travetto/cli';

import { Repo } from './bin/repo';

/**
 * `npx trv repo:dep-graph`
 *
 * Produces a dependency graph
 */
export class RepoDepGraphCommand extends CliCommand {

  name = 'repo:dep-graph';

  async action(...args: unknown[]): Promise<void> {
    const graph = await Repo.graph;

    console.log!('digraph g {');
    for (const [pkg, deps] of graph.entries()) {
      for (const dep of deps) {
        if (dep.public) {
          console.log!(`  "${dep.name}" -> "${pkg.name}";`)
        }
      }
    }
    console.log!('}');
  }
}