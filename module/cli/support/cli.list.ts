import { BaseCliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

type Options = {
  changed: OptionConfig<boolean>;
  graph: OptionConfig<boolean>;
};

/**
 * `npx trv list`
 *
 * Allows for listing of modules
 */
export class RepoListCommand extends BaseCliCommand<Options> {

  name = 'list';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only show changed modules', def: false }),
      graph: this.boolOption({ desc: 'Show as a digraph', def: false })
    };
  }

  async action(...args: unknown[]): Promise<void> {
    const mods = await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all');
    if (!this.cmd.graph) {
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