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

    const modules = await CliModuleUtil.findModules(this.changed ? 'changed' : 'workspace', this.fromHash, this.toHash);
    switch (this.format) {
      case 'list': {
        for (const mod of modules.map(x => x.sourceFolder).toSorted()) {
          await write(mod);
        }
        break;
      }
      case 'json': {
        const outputMap = CliModuleUtil.getDependencyGraph(modules);
        await write(JSON.stringify(Object.entries(outputMap)
          .map(([name, children]) => ({ name, children, workspace: RuntimeIndex.getModule(name)?.workspace })), null, 2));
        break;
      }
      case 'graph': {
        await write('digraph g {');
        for (const module of modules) {
          for (const dep of module.parents) {
            if (dep !== Runtime.main.name) {
              await write(`  "${dep}" -> "${module.name}";`);
            }
          }
        }
        await write('}');
        break;
      }
    }
  }
}