import { BaseCliCommand, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * `npx trv list`
 *
 * Allows for listing of modules
 */
@CliCommand()
export class RepoListCommand implements BaseCliCommand {

  /** Only show changed modules */
  changed = false;

  /** Show as a digraph */
  graph = false;

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async action(): Promise<void> {
    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');
    if (!this.graph) {
      for (const mod of mods.map(x => x.sourceFolder).sort()) {
        console.log!(mod);
      }
    } else {
      console.log!('digraph g {');
      for (const el of mods) {
        for (const dep of el.parents) {
          if (dep !== RootIndex.mainPackage.name) {
            console.log!(`  "${dep}" -> "${el.name}";`);
          }
        }
      }
      console.log!('}');
    }
  }
}