import { CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

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

  /** Base revision to check against */
  since?: string;

  async main(): Promise<void> {

    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all', this.since);
    switch (this.format) {
      case 'list': {
        for (const mod of mods.map(x => x.sourceFolder).sort()) {
          await write(mod);
        }
        break;
      }
      case 'json': {
        const outputMap = CliModuleUtil.getDependencyGraph(mods);
        await write(JSON.stringify(Object.entries(outputMap).map(([name, children]) => ({ name, children, local: RootIndex.getModule(name)?.local })), null, 2));
        break;
      }
      case 'graph': {
        await write('digraph g {');
        for (const el of mods) {
          for (const dep of el.parents) {
            if (dep !== RootIndex.mainModuleName) {
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