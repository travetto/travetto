import { CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * Allows for listing of modules
 */
@CliCommand()
export class RepoListCommand implements CliCommandShape {

  /** Only show changed modules */
  changed = false;

  /** Show as a digraph */
  graph = false;

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async main(): Promise<void> {
    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');
    if (!this.graph) {
      for (const mod of mods.map(x => x.sourceFolder).sort()) {
        process.stdout.write(`${mod}\n`);
      }
    } else {
      process.stdout.write('digraph g {\n');
      for (const el of mods) {
        for (const dep of el.parents) {
          if (dep !== RootIndex.mainPackage.name) {
            process.stdout.write(`  "${dep}" -> "${el.name}";\n`);
          }
        }
      }
      process.stdout.write('}\n');
    }
  }
}