import { type CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { JSONUtil, Runtime, RuntimeIndex } from '@travetto/runtime';

const write = (line: string): Promise<void> => new Promise(resolve => process.stdout.write(`${line}\n`, () => resolve()));

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
        for (const folder of modules.map(module => module.sourceFolder).toSorted()) {
          await write(folder);
        }
        break;
      }
      case 'json': {
        const outputMap = CliModuleUtil.getDependencyGraph(modules);
        await write(JSONUtil.toUTF8(
          Object.entries(outputMap)
            .map(([name, children]) => ({ name, children, workspace: RuntimeIndex.getModule(name)?.workspace })),
          { indent: 2 }
        ));
        break;
      }
      case 'graph': {
        await write('digraph g {');
        for (const module of modules) {
          for (const parent of module.parents) {
            if (parent !== Runtime.main.name) {
              await write(`  "${parent}" -> "${module.name}";`);
            }
          }
        }
        await write('}');
        break;
      }
    }
  }
}