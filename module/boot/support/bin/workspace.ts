import * as fs from 'fs/promises';

import { Manifest, path } from '@travetto/common';

export class WorkspaceManager {

  #outDir: string;

  constructor(outDir: string) {
    this.#outDir = path.resolve(outDir);
  }

  get outDir(): string {
    return this.#outDir;
  }

  async sourceExists(module: Manifest.Module, file: string): Promise<boolean> {
    return !!(await fs.stat(path.resolve(module.source, file)).catch(() => false));
  }

  async symlinkFolder(module: Manifest.Module, key: string): Promise<void> {
    if (module.files[key] && await this.sourceExists(module, key)) {
      const output = path.resolve(this.#outDir, module.output, key);
      await fs.mkdir(path.dirname(output), { recursive: true });

      console.debug('Symlinking', output);
      if (!(await fs.stat(output).catch(() => false))) {
        await fs.symlink(path.resolve(module.source, key), output);
      }
    }
  }

  async copyFile(module: Manifest.Module, file: string): Promise<void> {
    if (await this.sourceExists(module, file)) {
      const outFile = path.resolve(this.#outDir, module.output, file);
      console.debug('Copying', outFile);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.copyFile(path.resolve(module.source, file), outFile);
    }
  }

  async writeFile(module: Manifest.Module, file: string, contents: string): Promise<void> {
    const outFile = path.resolve(this.#outDir, module.output, file);
    return this.writeRawFile(outFile, contents);
  }

  async writeRawFile(file: string, contents: string): Promise<void> {
    const outFile = path.resolve(this.#outDir, file);
    console.debug('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, 'utf8');
  }

  async readFile(module: Manifest.Module, file: string): Promise<string> {
    return fs.readFile(path.resolve(module.source, file), 'utf8');
  }
}