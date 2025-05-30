import { CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

const write = (line: string): Promise<void> => new Promise(r => process.stdout.write(`${line}\n`, () => r()));

/**
 * Allows for listing of modules
 */
@CliCommand()
export class ListModuleCommand implements CliCommandShape {

  /** Only show changed modules */
  changed = false;

  /** Output format */
  format: 'graph' | 'json' | 'list' = 'list';

  /**
   * Start revision to check against
   * @alias fh
   */
  fromHash?: string;

  /**
   * End revision to check against
   * @alias th
   */
  toHash?: string;

  async main(): Promise<void> {

    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'workspace', this.fromHash, this.toHash);
    switch (this.format) {
      case 'list': {
        for (const mod of mods.map(x => x.sourceFolder).toSorted()) {
          await write(mod);
        }
        break;
      }
      case 'json': {
        const outputMap = CliModuleUtil.getDependencyGraph(mods);
        await write(JSON.stringify(Object.entries(outputMap)
          .map(([name, children]) => ({ name, children, workspace: RuntimeIndex.getModule(name)?.workspace })), null, 2));
        break;
      }
      case 'graph': {
        await write('digraph g {');
        for (const el of mods) {
          for (const dep of el.parents) {
            if (dep !== Runtime.main.name) {
              await write(`  "${dep}" -> "${el.name}";`);
            }
          }
        }
        await write('}');
        break;
      }
    }
  }
}