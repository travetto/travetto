import fs from 'node:fs/promises';

import { PackageUtil } from '@travetto/manifest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';

type DocModMapping = { simpleName: string, name: string, displayName: string, folder: string, description?: string };

/**
 * Generate module mapping for @travetto/doc
 */
@CliCommand()
export class DocModuleMapping {

  /** Output file for mapping */
  output = 'module/doc/src/mapping/mod-mapping.ts';

  async main(): Promise<void> {
    const out: DocModMapping[] = [];
    for (const module of RuntimeIndex.getManifestModules()) {
      const pkg = PackageUtil.readPackage(Runtime.workspaceRelative(module.sourceFolder));
      if (pkg?.travetto?.displayName === undefined) {
        continue;
      }

      const simpleName = pkg.name
        .split('/')[1]
        .replace(/^[a-z]/, x => x.toUpperCase())
        .replace(/([a-z])-([a-z])/g, (_, l, r) => `${l}${r.toUpperCase()}`);
      out.push({
        simpleName,
        name: module.name,
        displayName: pkg.travetto.displayName,
        folder: module.sourceFolder,
        description: pkg.description
      });
    }
    const text: string[] = [];

    for (const mod of out.toSorted((a, b) => a.name.localeCompare(b.name))) {
      text.push(`
  ${mod.simpleName}: {
    name: '${mod.name}', folder: '${mod.name}', displayName: '${mod.displayName}',
    description: '${mod.description?.replaceAll("'", '\\\'')}'
  }`);
    }

    await fs.writeFile(this.output, `export const MOD_MAPPING = {${text.join(',')}\n};\n`, 'utf8');

    console.log(`Successfully wrote ${this.output}`);
  }
}