import { mkdirSync, writeFileSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { ModuleShape, ManifestUtil } from '@travetto/manifest';

const CWD = process.cwd();

export class WorkspaceManager {

  #outDir: string;
  #bootLocation: string;
  #modules: ModuleShape[];
  #sourceToOutput: (file: string) => string;

  constructor(outDir: string, bootLocation?: string) {
    this.#outDir = path.resolve(outDir).replaceAll('\\', '/');
    this.#bootLocation = path.resolve(bootLocation ?? __filename.split('node_modules')[0]).replaceAll('\\', '/');
    this.#modules = Object.values(ManifestUtil.readManifest(`${this.#bootLocation}/manifest.json`)!.modules);

    this.#sourceToOutput = (file: string): string => {
      for (const m of this.#modules) {
        if (file.startsWith(m.source)) {
          return file.replace(m.source, m.output);
        }
      }
      return file;
    };
  }

  get outDir() {
    return this.#outDir;
  }

  get modules() {
    return this.#modules;
  }

  resolveInBoot(module: ModuleShape, relative: string): string {
    return `${this.#bootLocation}/${module.output}/${relative}`;
  }

  async symlinkFolder(module: ModuleShape, key: string): Promise<void> {
    if (await fs.stat(`${module.source}/${key}`).then(x => true, x => false)) {
      await fs.mkdir(`${this.#outDir}/${module.output}/${key}`, { recursive: true });
    }

    if (module.files[key]) {
      const output = `${this.#outDir}/${module.output}/${key}`;
      await fs.mkdir(path.dirname(output));
      console.log('Symlinking', output);
      await fs.symlink(`${module.source}/${key}`, output)
    }
  }

  async copyFile(module: ModuleShape, file: string): Promise<void> {
    const outFile = `${this.#outDir}/${module.output}/${file}`;
    console.log('Copying', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.copyFile(`${module.source}/${file}`, outFile);
  }

  async writeFile(module: ModuleShape, file: string, contents: string): Promise<void> {
    const outFile = `${this.#outDir}/${module.output}/${file}`;
    console.log('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, 'utf8');
  }

  async transformFile(module: ModuleShape, file: string, mapper: (text: string) => string): Promise<void> {
    const text = await fs.readFile(`${module.source}/${file}`, 'utf8');
    this.writeFile(module, file, mapper(text));
  }

  writeSourceOutput(file: string, text: string): void {
    const output = this.#sourceToOutput(file);
    const finalTarget = file.startsWith(CWD) ? `${CWD}/${output}` : `${this.outDir}/${output}`;
    mkdirSync(path.dirname(finalTarget), { recursive: true });
    writeFileSync(finalTarget, text, 'utf8');
  }

  async init(): Promise<void> {
    for (const module of this.#modules) {
      if (module.files.rootFiles?.find(([f]) => f === 'package.json')) {
        await this.transformFile(module, 'package.json', text =>
          text.replace(/"index.ts"/g, '"index.js"'));
      }

      // Copy over all js files
      for (const files of Object.values(module.files)) {
        for (const [jsFile, ext] of files!) {
          if (ext === 'js') {
            await this.copyFile(module, jsFile);
          }
        }
      }

      // Symlink resources
      await this.symlinkFolder(module, 'resources');
      await this.symlinkFolder(module, 'support/resources');
      if (!module.output) {
        await this.symlinkFolder(module, 'test/resources');
      }
    }

    // Write manifest
    const main = this.#modules.find(x => !x.output)!;
    await this.writeFile(main, 'manifest.json', JSON.stringify(this.#modules));
  }

}