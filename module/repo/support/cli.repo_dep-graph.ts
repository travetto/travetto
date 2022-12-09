import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex, PackageUtil } from '@travetto/manifest';

/**
 * `npx trv repo:dep-graph`
 *
 * Produces a dependency graph
 */
export class RepoDepGraphCommand extends CliCommand {

  name = 'repo:dep-graph';

  async action(...args: unknown[]): Promise<void> {
    const root = PackageUtil.readPackage(RootIndex.manifest.workspacePath);

    console.log!('digraph g {');
    for (const el of await CliModuleUtil.findModules('all')) {
      for (const dep of el.parents) {
        if (dep !== root.name) {
          console.log!(`  "${dep}" -> "${el.name}";`);
        }
      }
    }
    console.log!('}');
  }
}