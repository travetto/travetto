import * as fs from 'fs/promises';
import * as os from 'os';

import * as path from './path';

import type { Manifest, ManifestModuleFile, ManifestState, ManifestModule, ManifestDeltaEvent, ManifestDelta, Package } from './types';

type Dependency = { id?: string, version: string, name: string, folder: string, isModule: boolean, profiles?: string[] };
type DeltaModuleFiles = Record<string, ManifestModuleFile>;

export class ManifestUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  static async #collectPackages(folder: string, seen = new Set<string>()): Promise<Dependency[]> {
    const { name, version, dependencies = {}, devDependencies = {}, peerDependencies = {}, peerDependenciesMeta = {}, travetto }: Package =
      JSON.parse(await fs.readFile(`${folder}/package.json`, 'utf8'));

    if (seen.has(name)) {
      return [];
    }

    const isModule = !!travetto || folder === path.cwd();
    const out: Dependency[] = [{ id: travetto?.id, name, version, folder, isModule, profiles: travetto?.profiles }];
    seen.add(name);
    const searchSpace = [
      ...Object.entries(dependencies).map(([k, v]) => [k, v, 'dep'] as const),
      ...(isModule ? Object.entries(devDependencies).map(([k, v]) => [k, v, 'dev'] as const) : []),
      ...Object.entries(peerDependencies).map(([k, v]) => [k, v, 'peer'] as const)
        .filter(([x]) => {
          try {
            require.resolve(x);
            return true;
          } catch {
            return false;
          }
        }),
    ].sort(([a, b]) => a[0].localeCompare(b[0]));

    for (const [el, value, type] of searchSpace) {
      if (type === 'peer') {
        const profiles = peerDependenciesMeta?.[el].profiles;
        if (profiles) {
          // TODO: Filter by profiles
          continue;
        }
      }
      if (value.startsWith('file:')) {
        out.push(...await this.#collectPackages(path.resolve(folder, value.replace('file:', '')), seen));
      } else {
        try {
          const next = path.resolve(require.resolve(el))
            .replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
          out.push(...await this.#collectPackages(next, seen));
        } catch (e) { }
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

  static async #transformFile(relative: string, full: string): Promise<ManifestModuleFile> {
    const type = relative.endsWith('.d.ts') ? 'd.ts' : (
      relative.endsWith('.ts') ? 'ts' : (
        (relative.endsWith('.js') || relative.endsWith('mjs') || relative.endsWith('.cjs')) ? 'js' :
          (relative.endsWith('.json') ? 'json' : 'unknown')
      ));
    return [relative, type, this.#getNewest(await fs.stat(full))];
  }

  static async #describeModule(rootFolder: string, { id, name, version, folder, profiles }: Dependency): Promise<ManifestModule> {
    const files: Record<string, ManifestModuleFile[]> = {};
    const folderSet = folder !== rootFolder ? new Set<string>(['src', 'bin', 'support']) : new Set<string>();

    for (const file of await this.#scanFolder(folder, folderSet)) {
      // Group by top folder
      const rel = file.replace(`${folder}/`, '');
      const entry = await this.#transformFile(rel, file);
      if (!rel.includes('/')) { // If a file
        if (rel === 'index.ts') {
          files.index = [entry];
        } else if (rel === 'doc.ts') {
          files.docIndex = [entry];
        } else {
          (files['rootFiles'] ??= []).push(entry);
        }
      } else {
        const sub = rel.match(/^((?:(test|support)\/resources)|[^/]+)/)![0];
        (files[sub] ??= []).push(entry);
      }
    }

    // Refine non-main module
    if (folder !== rootFolder) {
      files.rootFiles = files.rootFiles.filter(([file, type]) => type !== 'ts');
    }

    // Cleaning up names
    id ??= folder.includes('node_modules') ?
      `@npm:${name.replace('/', ':')}` :
      name.replace('/', ':');

    return {
      id,
      profiles,
      name,
      version,
      source: folder,
      output: folder === rootFolder ? '.' : `node_modules/${name}`,
      files
    };
  }

  static async #buildManifestModules(rootFolder: string): Promise<Record<string, ManifestModule>> {
    const modules = (await this.#collectPackages(rootFolder))
      .filter(x => x.isModule);
    if (!modules.find(x => x.name === '@travetto/cli')) {
      const folder = path.resolve(__dirname, '..', '..', '..', 'cli');
      if (await fs.stat(folder).catch(() => false)) {
        modules.unshift(...(await this.#collectPackages(folder)));
      }
    }
    const out: Record<string, ManifestModule> = {};
    for (const mod of modules) {
      const cfg = await this.#describeModule(rootFolder, mod);
      out[cfg.name] = cfg;
    }
    return out;
  }

  static async buildManifest(rootFolder: string): Promise<Manifest> {
    return {
      modules: await this.#buildManifestModules(rootFolder),
      generated: Date.now()
    };
  }

  static async writeManifest(file: string, manifest: Manifest): Promise<void> {
    let folder = file;
    if (file.endsWith('.json')) {
      folder = path.dirname(file);
    } else {
      file = `${folder}/manifest.json`;
    }
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(file, JSON.stringify(manifest));
  }

  static async readManifest(file: string): Promise<Manifest | undefined>;
  static async readManifest(file: string, createStub: true): Promise<Manifest>;
  static async readManifest(file: string, createStub = false): Promise<Manifest | undefined> {
    let folder = file;
    if (!file.endsWith('.json')) {
      file = `${folder}/manifest.json`;
    }
    if (await fs.stat(file).catch(() => false)) {
      return JSON.parse(
        await fs.readFile(file, 'utf8')
      );
    } else {
      return createStub ? { modules: {}, generated: Date.now() } : undefined;
    }
  }

  static #flattenModuleFiles(m: ManifestModule): DeltaModuleFiles {
    const out: DeltaModuleFiles = {};
    for (const key of Object.keys(m.files)) {
      for (const [name, type, date] of m.files[key]) {
        if (type === 'ts') {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  static async #deltaModules(
    outputFolder: string,
    left: ManifestModule<DeltaModuleFiles>,
    right: ManifestModule<DeltaModuleFiles>
  ): Promise<ManifestDeltaEvent[]> {
    const out: ManifestDeltaEvent[] = [];
    for (const el of Object.keys(left.files)) {
      if (!(el in right.files)) {
        out.push([el, 'added']);
      } else {
        const [, , leftTs] = left.files[el];
        const [, , rightTs] = right.files[el];
        if (leftTs != rightTs) {
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

  static async produceDelta(outputFolder: string, left: Manifest, right: Manifest): Promise<ManifestDelta> {
    const deltaLeft = Object.fromEntries(
      Object.values(left.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const deltaRight = Object.fromEntries(
      Object.values(right.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, ManifestDeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = await this.#deltaModules(outputFolder, lMod, deltaRight[name] ?? { files: {}, name });
    }

    return out;
  }

  static async readState(file: string): Promise<ManifestState> {
    const cfg: ManifestState = JSON.parse(await fs.readFile(file, 'utf8'));
    return cfg;
  }

  static async writeState(state: ManifestState): Promise<string> {
    const manifestTemp = path.resolve(os.tmpdir(), `manifest-state.${Date.now()}${Math.random()}.json`);
    await fs.writeFile(manifestTemp, JSON.stringify(state), 'utf8');
    return manifestTemp;
  }

  static async produceState(rootFolder: string, outputFolder: string): Promise<ManifestState> {
    const manifest = await this.buildManifest(rootFolder);
    const delta = await this.produceDelta(outputFolder, manifest, await ManifestUtil.readManifest(outputFolder, true));
    return { manifest, delta };
  }
}