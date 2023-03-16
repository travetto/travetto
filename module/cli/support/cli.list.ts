import { CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

const write = (line: string): Promise<void> => new Promise(r => process.stdout.write(`${line}\n`, () => r()));

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
        await write(mod);
      }
    } else {
      await write('digraph g {');
      for (const el of mods) {
        for (const dep of el.parents) {
          if (dep !== RootIndex.mainPackage.name) {
            await write(`  "${dep}" -> "${el.name}";`);
          }
        }
      }
      await write('}');
    }
  }
}