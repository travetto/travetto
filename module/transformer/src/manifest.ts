import { path, ManifestModule, ManifestRoot } from '@travetto/manifest';

type ManifestEntry = { import: string, out: string, src: string, module: string };

export class ManifestManager {
  #srcToEntry: Record<string, ManifestEntry> = {};
  #outToEntry: Record<string, ManifestEntry> = {};
  #modToEntry: Record<string, ManifestEntry> = {};
  #main: ManifestModule;

  constructor(manifest: ManifestRoot) {
    for (const mod of Object.values(manifest.modules)) {
      if (mod.main) {
        this.#main = mod;
      }
      for (const files of Object.values(mod.files)) {
        for (const [file] of files) {
          const src = path.resolve(mod.source, file);
          const out = path.resolve(mod.output, file);
          const modImp = `${mod.name}/${file}`;
          const entry = { import: modImp, out, src, module: mod.name };
          this.#srcToEntry[src] = entry;

          this.#outToEntry[out] = entry;
          this.#outToEntry[out.replace(/[.][tj]s$/, '')] = entry;
          this.#outToEntry[out.replace(/[.]ts$/, '.js')] = entry;

          this.#modToEntry[modImp] = entry;
          this.#modToEntry[modImp.replace(/[.][tj]s$/, '')] = entry;
          this.#modToEntry[modImp.replace(/[.]ts$/, '.js')] = entry;
        }
      }
    }
  }

  get main(): ManifestModule {
    return this.#main;
  }

  knownFile(file: string): boolean {
    return !!file && (file in this.#srcToEntry || file in this.#outToEntry || file in this.#modToEntry);
  }

  ensureOutputFile(file: string): string;
  ensureOutputFile(file?: string): string | undefined {
    if (file) {
      file = path.toPosix(file);
      return this.#srcToEntry[file]?.out ?? file;
    }
  }

  toSource(file: string): string {
    const resolved = file.replace(/.*node_modules/g, 'node_modules');
    return this.#outToEntry[resolved]?.src ?? file;
  }

  getEntry(file: string): ManifestEntry {
    return this.#srcToEntry[file] ?? this.#outToEntry[file] ?? this.#modToEntry[file];
  }

  /**
   * Resolve a file to the "import/require" input
   * @param file
   */
  resolveModule(file: string): string {
    file = path.toPosix(file);
    file = this.getEntry(file)?.import ?? file;
    if (file.includes('node_modules')) { // it is a module
      file = file.replace(/.*node_modules\//, '');
    } else {
      file = file.replace(path.cwd(), '.');
    }
    return file.replace(/[.][tj]s$/, '');
  }
}