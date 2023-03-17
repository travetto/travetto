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

  /** Output format */
  format: 'graph' | 'json' | 'list' = 'list';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async main(): Promise<void> {

    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');
    switch (this.format) {
      case 'list':
        for (const mod of mods.map(x => x.sourceFolder).sort()) {
          await write(mod);
        }
        break;
      case 'graph':
        await write('digraph g {');
        for (const el of mods) {
          for (const dep of el.parents) {
            if (dep !== RootIndex.mainPackage.name) {
              await write(`  "${dep}" -> "${el.name}";`);
            }
          }
        }
        await write('}');
        break;
      case 'json': {
        type Entry = { children: Set<string>, name: string, active: Set<string>, parents?: string[] };
        const childMap: Map<string, Entry> = new Map();
        const get = (name: string): Entry =>
          childMap.has(name) ? childMap.get(name)! : childMap.set(name, { children: new Set(), name, active: new Set() }).get(name)!;

        for (const el of mods) {
          get(el.name).parents = el.parents;
          for (const dep of el.parents) {
            const par = get(dep);
            par.children.add(el.name); // Store child into parent
            par.active.add(el.name);
          }
        }

        const output: string[] = [];

        while (childMap.size > 0) {
          for (const el of [...childMap.values()].filter(x => x.active.size === 0)) {
            output.push(JSON.stringify({ name: el.name, children: [...el.children] }));
            for (const parent of el.parents ?? []) {
              // Extend children into parents
              for (const val of el.children) {
                childMap.get(parent)!.children.add(val);
              }
            }
            for (const val of childMap.values()) {
              val.active.delete(el.name);
            }
            childMap.delete(el.name);
          }
        }

        await write(`[\n${output.join(',\n')}\n]`);
        break;
      }
    }
  }
}