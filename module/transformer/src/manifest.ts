import { path, ManifestModule } from '@travetto/common';

export class ManifestManager {
  #srcToMod: Record<string, string> = {};
  #outToMod: Record<string, string> = {};
  #srcToOut: Record<string, string> = {};
  #outToSrc: Record<string, string> = {};
  #main: ManifestModule;

  constructor(modules: ManifestModule[]) {
    for (const mod of modules) {
      if (mod.main) {
        this.#main = mod;
      }
      for (const files of Object.values(mod.files)) {
        for (const [file] of files) {
          const src = path.resolve(mod.source, file);
          const out = path.resolve(mod.output, file);
          const modImp = `${mod.name}/${file}`;
          this.#srcToMod[src] = modImp;
          this.#outToMod[out] = modImp;
          this.#srcToOut[src] = out;
          this.#outToSrc[`${mod.output}/${file}`] = src;
        }
      }
    }
  }

  get main() {
    return this.#main;
  }

  knownFile(file: string): boolean {
    return file && file in this.#srcToMod || file in this.#outToMod;
  }

  ensureOutputFile(file: string): string;
  ensureOutputFile(file?: string): string | undefined {
    if (file) {
      file = path.toPosix(file);
      return this.#srcToOut[file] ?? file;
    }
  }

  toSource(file: string): string {
    return this.#outToSrc[file.replace(/.*node_modules/g, 'node_modules')] ?? file;
  }

  /**
   * 
   * @param file 
   */
  resolveModule(file: string): string {
    file = path.toPosix(file);
    if (file in this.#srcToMod) {
      file = this.#srcToMod[file];
    } else if (file in this.#outToMod) {
      file = this.#outToMod[file];
    }
    if (file.includes('node_modules')) { // it is a module      
      file = file.replace(/.*node_modules\//, '');
    } else {
      file = file.replace(path.cwd(), '.');
    }
    return file.replace(/[.][tj]s$/, '');
  }
}