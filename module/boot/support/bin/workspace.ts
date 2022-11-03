import * as fs from 'fs/promises';

import * as path from './path';

import { ManifestModule } from './types';

export class WorkspaceManager {

  #outDir: string;

  constructor(outDir: string) {
    this.#outDir = path.resolve(outDir);
  }

  get outDir(): string {
    return this.#outDir;
  }

  async sourceExists(module: ManifestModule, file: string): Promise<boolean> {
    return fs.stat(`${module.source}/${file}`).then(() => true, () => false);
  }

  async symlinkFolder(module: ManifestModule, key: string): Promise<void> {
    if (module.files[key] && await this.sourceExists(module, key)) {
      const output = `${this.#outDir}/${module.output}/${key}`;
      await fs.mkdir(path.dirname(output), { recursive: true });

      console.debug('Symlinking', output);
      if (!(await fs.stat(output).catch(() => false))) {
        await fs.symlink(`${module.source}/${key}`, output);
      }
    }
  }

  async copyFile(module: ManifestModule, file: string): Promise<void> {
    if (await this.sourceExists(module, file)) {
      const outFile = `${this.#outDir}/${module.output}/${file}`;
      console.debug('Copying', outFile);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.copyFile(`${module.source}/${file}`, outFile);
    }
  }

  async writeFile(module: ManifestModule, file: string, contents: string): Promise<void> {
    return this.writeRawFile(`${module.output}/${file}`, contents);
  }

  async writeRawFile(file: string, contents: string): Promise<void> {
    const outFile = `${this.#outDir}/${file}`;
    console.debug('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, 'utf8');
  }

  async readFile(module: ManifestModule, file: string): Promise<string> {
    return fs.readFile(`${module.source}/${file}`, 'utf8');
  }
}