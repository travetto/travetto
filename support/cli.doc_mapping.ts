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
  output = 'module/doc/src/mapping/module.ts';

  async main(): Promise<void> {
    const out: DocModMapping[] = [];
    for (const module of RuntimeIndex.getManifestModules()) {
      const pkg = PackageUtil.readPackage(Runtime.workspaceRelative(module.sourceFolder));
      if (pkg?.travetto?.displayName === undefined) {
        continue;
      }

      const simpleName = pkg.name
        .split('/')[1]
        .replace(/^[a-z]/, name => name.toUpperCase())
        .replace(/([a-z])-([a-z])/g, (_, left, right) => `${left}${right.toUpperCase()}`);
      out.push({
        simpleName,
        name: module.name,
        displayName: pkg.travetto.displayName,
        folder: module.sourceFolder,
        description: pkg.description
      });
    }
    const text: string[] = [];

    for (const module of out.toSorted((a, b) => a.name.localeCompare(b.name))) {
      text.push(`
  ${module.simpleName}: {
    name: '${module.name}', folder: '${module.folder}', displayName: '${module.displayName}',
    description: '${module.description?.replaceAll("'", '\\\'')}'
  }`);
    }

    await fs.writeFile(this.output, `export const MODULE_MAPPING = {${text.join(',')}\n};\n`, 'utf8');

    console.log(`Successfully wrote ${this.output}`);
  }
}