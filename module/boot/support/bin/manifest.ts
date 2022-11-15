import * as fs from 'fs/promises';
import * as os from 'os';

import { Manifest, Package, path } from '@travetto/common';

const resolveImport = (library: string): string => require.resolve(library);

type Dependency = Package['travetto'] & { version: string, name: string, folder: string };
type DeltaModuleFiles = Record<string, Manifest.ModuleFile>;

export class ManifestUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  static async #collectPackages(folder: string, transitiveProfiles: string[] = [], seen = new Map<string, Dependency>()): Promise<Dependency[]> {
    const { name, version, dependencies = {}, devDependencies = {}, peerDependencies = {}, travetto }: Package =
      JSON.parse(await fs.readFile(`${folder}/package.json`, 'utf8'));

    if (seen.has(name)) {
      const dep = seen.get(name)!;
      if (dep.profileInherit !== false) {
        for (const el of transitiveProfiles) {
          (dep.profiles ??= []).push(el);
        }
      }
      return [];
    }

    const isModule = !!travetto || folder === path.cwd();
    if (!isModule) {
      return [];
    }

    const profiles = travetto?.profileInherit !== false ?
      [...travetto?.profiles ?? [], ...transitiveProfiles] :
      [...travetto?.profiles ?? []].slice(0);

    const rootDep: Dependency = { id: travetto?.id, name, version, folder, profiles, profileInherit: travetto?.profileInherit };
    seen.set(name, rootDep);

    const out: Dependency[] = [rootDep];

    const searchSpace = [
      ...Object.entries(dependencies).map(([k, v]) => [k, v, 'dep'] as const),
      ...Object.entries(devDependencies).map(([k, v]) => [k, v, 'dev'] as const),
      ...Object.entries(peerDependencies).map(([k, v]) => [k, v, 'peer'] as const)
        .filter(([x]) => {
          try {
            resolveImport(x);
            return true;
          } catch {
            return false;
          }
        }),
    ].sort(([a, b]) => a[0].localeCompare(b[0]));

    for (const [el, value, type] of searchSpace) {
      const subProfiles = type === 'peer' ? transitiveProfiles : profiles;
      if (value.startsWith('file:')) {
        out.push(...await this.#collectPackages(path.resolve(folder, value.replace('file:', '')), subProfiles, seen));
      } else {
        let next: string;
        try {
          next = path.resolve(resolveImport(el));
        } catch {
          continue;
        }
        next = next.replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
        out.push(...await this.#collectPackages(next, subProfiles, seen));
      }
    }
    return out;
  }

  static async #scanFolder(folder: string, includeTopFolders = new Set<string>()): Promise<string[]> {
    const out: string[] = [];
    if (!fs.stat(folder).catch(() => false)) {
      return out;
    }
    const stack: [string, number][] = [[folder, 0]];
    while (stack.length) {
      const [top, depth] = stack.pop()!;

      // Don't navigate into sub-folders with package.json's
      if (top !== folder && await fs.stat(`${top}/package.json`).catch(() => false)) {
        continue;
      }

      for (const sub of await fs.readdir(top)) {
        const stat = await fs.stat(`${top}/${sub}`);
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

  static async #transformFile(relative: string, full: string): Promise<Manifest.ModuleFile> {
    const type = relative.endsWith('.d.ts') ? 'd.ts' : (
      relative.endsWith('.ts') ? 'ts' : (
        (relative.endsWith('.js') || relative.endsWith('.mjs') || relative.endsWith('.cjs')) ? 'js' :
          (relative.endsWith('.json') ? 'json' : 'unknown')
      ));
    return [relative, type, this.#getNewest(await fs.stat(full))];
  }

  static async #describeModule(rootFolder: string, { id, name, version, folder, profiles }: Dependency): Promise<Manifest.Module> {
    const main = folder === rootFolder;
    const local = (!folder.includes('node_modules') && !name.startsWith('@travetto')) || main;

    const files: Record<string, Manifest.ModuleFile[]> = {};
    const folderSet = !main ? new Set<string>(['src', 'bin', 'support']) : new Set<string>();

    for (const file of await this.#scanFolder(folder, folderSet)) {
      // Group by top folder
      const rel = file.replace(`${folder}/`, '');
      const entry = await this.#transformFile(rel, file);
      if (!rel.includes('/')) { // If a file
        if (rel === 'index.ts') {
          files.index = [entry];
        } else {
          (files['rootFiles'] ??= []).push(entry);
        }
      } else if (/(test|support)\/fixtures/.test(rel)) {
        entry[1] = 'fixture';
        const sub = rel.replace(/.*((?:test|support)\/fixtures)\/.*/, (_, p) => p);
        (files[sub] ??= []).push(entry);
      } else {
        const [sub] = rel.split('/');
        (files[sub] ??= []).push(entry);
      }
    }

    // Refine non-main module
    if (!main) {
      files.rootFiles = files.rootFiles.filter(([file, type]) => type !== 'ts');
    }

    if (name === '@travetto/boot') {
      files.support = files.support.filter(([x, v]) => v !== 'js');
    }

    // Cleaning up names
    id ??= (!local ? `@npm:${name}` : name).replace('/', ':');

    return {
      id,
      profiles: profiles?.includes('*') ? [] : [...new Set(profiles?.filter(x => x !== '*'))],
      name,
      version,
      main,
      local,
      source: folder,
      output: `node_modules/${name}`,
      files
    };
  }

  static async #buildManifestModules(rootFolder: string): Promise<Record<string, Manifest.Module>> {
    const modules = (await this.#collectPackages(rootFolder, ['*']));

    // TODO: Revisit logic
    if (!modules.some(x => x.name === '@travetto/cli')) {
      const folder = path.resolve(__dirname, '..', '..', '..', 'cli');
      if (await fs.stat(folder).catch(() => false)) {
        modules.unshift(...(await this.#collectPackages(folder, ['*'])));
      }
    }

    // TODO: Revisit logic
    if (!modules.some(x => x.name === '@travetto/test')) {
      const folder = path.resolve(__dirname, '..', '..', '..', 'test');
      if (await fs.stat(folder).catch(() => false)) {
        modules.unshift(...(await this.#collectPackages(folder, ['*'])));
      }
    }

    const out: Record<string, Manifest.Module> = {};
    for (const mod of modules.sort((a, b) => a.name.localeCompare(b.name))) {
      const cfg = await this.#describeModule(rootFolder, mod);
      out[cfg.name] = cfg;
    }
    return out;
  }

  static #flattenModuleFiles(m: Manifest.Module): DeltaModuleFiles {
    const out: DeltaModuleFiles = {};
    for (const key of Object.keys(m.files)) {
      for (const [name, type, date] of m.files[key]) {
        if (type === 'ts' || (type === 'json' && name.endsWith('package.json')) || (key === 'bin' && type === 'js')) {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  static async #deltaModules(
    outputFolder: string,
    left: Manifest.Module<DeltaModuleFiles>,
    right: Manifest.Module<DeltaModuleFiles>
  ): Promise<Manifest.DeltaEvent[]> {
    const out: Manifest.DeltaEvent[] = [];
    for (const el of Object.keys(left.files)) {
      if (!(el in right.files)) {
        out.push([el, 'added']);
      } else {
        const [, , leftTs] = left.files[el];
        const [, , rightTs] = right.files[el];
        if (leftTs !== rightTs) {
          out.push([el, 'changed']);
        } else {
          try {
            const stat = await fs.stat(`${outputFolder}/${left.output}/${el.replace(/[.]ts$/, '.js')}`);
            if (this.#getNewest(stat) < leftTs) {
              out.push([el, 'dirty']);
            }
          } catch {
            out.push([el, 'missing']);
          }
        }
      }
    }
    for (const el of Object.keys(right.files)) {
      if (!(el in left.files)) {
        out.push([el, 'removed']);
      }
    }
    return out;
  }

  static wrapModules(modules: Record<string, Manifest.Module>): Manifest.Root {
    return {
      main: Object.values(modules).find(x => x.main)?.name ?? '__tbd__',
      modules, generated: Date.now(),
      buildLocation: '__tbd__'
    };
  }

  static async buildManifest(rootFolder: string): Promise<Manifest.Root> {
    return this.wrapModules(await this.#buildManifestModules(rootFolder));
  }

  static async readManifest(folder: string): Promise<Manifest.Root> {
    const file = path.resolve(folder, 'manifest.json');
    if (await fs.stat(file).catch(() => false)) {
      return JSON.parse(
        await fs.readFile(file, 'utf8')
      );
    } else {
      return this.wrapModules({});
    }
  }

  static async produceDelta(outputFolder: string, left: Manifest.Root, right: Manifest.Root): Promise<Manifest.Delta> {
    const deltaLeft = Object.fromEntries(
      Object.values(left.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const deltaRight = Object.fromEntries(
      Object.values(right.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, Manifest.DeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = await this.#deltaModules(outputFolder, lMod, deltaRight[name] ?? { files: {}, name });
    }

    return out;
  }

  static async readState(file: string): Promise<Manifest.State> {
    const cfg: Manifest.State = JSON.parse(await fs.readFile(file, 'utf8'));
    return cfg;
  }

  static async writeState(state: Manifest.State, file?: string): Promise<string> {
    const manifestTemp = file ?? path.resolve(os.tmpdir(), `manifest-state.${Date.now()}${Math.random()}.json`);
    await fs.writeFile(manifestTemp, JSON.stringify(state), 'utf8');
    return manifestTemp;
  }

  static async produceState(rootFolder: string, outputFolder: string): Promise<Manifest.State> {
    const manifest = await this.buildManifest(rootFolder);
    const oldManifest = await this.readManifest(outputFolder);
    const delta = await this.produceDelta(outputFolder, manifest, oldManifest);
    return { manifest, delta };
  }
}