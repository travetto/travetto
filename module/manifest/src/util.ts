import * as fs from 'fs';
import * as path from 'path';

import type { ManifestShape, ModuleFile, ModuleShape } from './types';

const CWD = process.cwd().replace(/[\\]/g, '/');

type PackageType = {
  name: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  travettoModule?: boolean;
};

type Dependency = { name: string, folder: string, isModule: boolean };
type DeltaModuleFiles = Record<string, ModuleFile>;
type DeltaEvent = [string, 'added' | 'changed' | 'removed' | 'missing' | 'dirty'];

export class ManifestUtil {

  static #getNewest(stat: fs.Stats) {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  static #collectPackages(folder: string, seen = new Set<string>()): Dependency[] {
    const { name, dependencies = {}, devDependencies = {}, peerDependencies = {}, travettoModule = false }: PackageType =
      JSON.parse(fs.readFileSync(`${folder}/package.json`, 'utf8'));

    if (seen.has(name)) {
      return [];
    }
    const isModule = name.startsWith('@travetto') || travettoModule;
    const out = [{ name, folder, isModule }];
    seen.add(name);
    const searchSpace = [
      ...Object.keys(dependencies),
      ...[...Object.keys(devDependencies)].filter(x => x.startsWith('@travetto/')),
      ...[...Object.keys(peerDependencies)].filter(x => x.startsWith('@travetto/')),
    ].sort();

    for (const el of searchSpace) {
      try {
        const next = require.resolve(el).replace(/[\\]/g, '/')
          .replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
        out.push(...this.#collectPackages(next, seen));
      } catch (e) {
        if (process.env.TRV_DEV && el.startsWith('@travetto')) {
          out.push(...this.#collectPackages(el.replace('@travetto', process.env.TRV_DEV), seen));
        }
      }
    }
    return out;
  }

  static #scanFolder(folder: string, includeTopFolders = new Set<string>()): string[] {
    const out: string[] = [];
    if (!fs.existsSync(folder)) {
      return out;
    }
    const stack: [string, number][] = [[folder, 0]];
    while (stack.length) {
      const [top, depth] = stack.pop()!;
      for (const sub of fs.readdirSync(top)) {
        const stat = fs.statSync(`${top}/${sub}`);
        if (stat.isFile()) {
          out.push(`${top}/${sub}`);
        } else {
          if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !includeTopFolders.size || includeTopFolders.has(sub))) {
            stack.push([`${top}/${sub}`, depth + 1]);
          }
        }
      }
    }
    return out;
  }

  static #transformFile(relative: string, full: string): ModuleFile {
    const type = relative.endsWith('.d.ts') ? 'd.ts' : (
      relative.endsWith('.ts') ? 'ts' : (
        (relative.endsWith('.js') || relative.endsWith('mjs') || relative.endsWith('.cjs')) ? 'js' :
          (relative.endsWith('.json') ? 'json' : 'unknown')
      ));
    return [relative, type, this.#getNewest(fs.statSync(full))];
  }

  static #describeModule({ name, folder }: Dependency): ModuleShape {
    const files = this.#scanFolder(folder, folder !== CWD ? new Set<string>(['src', 'bin', 'support']) : new Set<string>())
      .reduce<Record<string, ModuleFile[]>>((acc, p) => {
        // Group by top folder
        const rel = p.replace(`${folder}/`, '');
        if (!rel.includes('/')) { // If a file
          if (rel === 'index.ts') {
            acc.index = [this.#transformFile(rel, p)];
          } else if (rel === 'doc.ts') {
            acc.docIndex = [this.#transformFile(rel, p)];
          } else {
            (acc['rootFiles'] ??= []).push(this.#transformFile(rel, p));
          }
        } else {
          const sub = rel.match(/^((?:(test|support)\/resources)|[^/]+)/)![0];
          (acc[sub] ??= []).push(this.#transformFile(rel, p));
        }
        return acc;
      }, {});

    // Refine non-main module
    if (folder !== CWD) {
      files.rootFiles = files.rootFiles.filter(([file, type]) => type !== 'ts');
    }

    return {
      name,
      source: folder,
      output: folder === CWD ? '' : `node_modules/${name}`,
      files
    };
  }

  static #buildManifestModules(): Record<string, ModuleShape> {
    const modules = this.#collectPackages(CWD)
      .filter(x => x.isModule);
    if (process.env.TRV_DEV && !modules.find(x => x.name === '@travetto/cli')) {
      modules.unshift({
        name: '@travetto/cli',
        folder: `${process.env.TRV_DEV}/cli`,
        isModule: true,
      });
    }
    return Object.fromEntries(
      modules.map(x => this.#describeModule(x)).map(m => [m.name, m])
    );
  }

  static buildManifest(): ManifestShape {
    return {
      modules: this.#buildManifestModules(),
      generated: Date.now()
    }
  }

  static writeManifest(file: string, manifest: ManifestShape): void {
    let folder = file;
    if (file.endsWith('.json')) {
      folder = path.dirname(file);
    } else {
      file = `${folder}/manifest.json`;
    }
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(manifest));
  }

  static readManifest(file: string): ManifestShape | undefined {
    let folder = file;
    if (file.endsWith('.json')) {
      folder = path.dirname(file);
    } else {
      file = `${folder}/manifest.json`;
    }
    if (fs.existsSync(file)) {
      return JSON.parse(
        fs.readFileSync(file, 'utf8')
      );
    } else {
      return undefined;
    }
  }


  static #flattenModuleFiles(m: ModuleShape): DeltaModuleFiles {
    const out: DeltaModuleFiles = {};
    for (const key of Object.keys(m.files)) {
      for (const [name, type, date] of m.files[key]) {
        if (type === 'ts' || type === 'd.ts') {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  static #deltaModules(outputFolder: string, left: ModuleShape<DeltaModuleFiles>, right: ModuleShape<DeltaModuleFiles>): DeltaEvent[] {
    let out: DeltaEvent[] = [];
    for (const el of Object.keys(left.files)) {
      if (!(el in right.files)) {
        out.push([el, 'added']);
      } else {
        const [, , leftTs] = left.files[el];
        const [, , rightTs] = right.files[el];
        if (leftTs > rightTs) {
          out.push([el, 'changed']);
        } else {
          try {
            const stat = fs.statSync(`${outputFolder}/${left.output}/${el}`);
            if (this.#getNewest(stat) > leftTs) {
              out.push([el, 'dirty']);
            }
          } catch {
            out.push([el, 'missing']);
          }
        }
      }
    }
    for (const el of Object.keys(right.files)) {
      if (!(el in left)) {
        out.push([el, 'removed']);
      }
    }
    return out;
  }

  static produceDelta(outputFolder: string, left: ManifestShape, right: ManifestShape): Record<string, DeltaEvent[]> {
    const deltaLeft = Object.fromEntries(
      Object.values(left.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const deltaRight = Object.fromEntries(
      Object.values(right.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, DeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = this.#deltaModules(outputFolder, lMod, deltaRight[name] ?? { files: {}, name })
    }

    return out;
  }

  static produceRelativeDelta(outputFolder: string, manifestFile: string): Record<string, DeltaEvent[]> {
    return this.produceDelta(
      outputFolder,
      ManifestUtil.buildManifest(),
      ManifestUtil.readManifest(manifestFile) ?? {
        modules: {},
        generated: Date.now()
      },
    );
  }
}