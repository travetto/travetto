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

function getNewest(stat: fs.Stats) {
  return Math.max(stat.mtimeMs, stat.ctimeMs);
}

function collectPackages(folder: string, seen = new Set<string>()): Dependency[] {
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
      out.push(...collectPackages(next, seen));
    } catch (e) {
      if (process.env.TRV_DEV && el.startsWith('@travetto')) {
        out.push(...collectPackages(el.replace('@travetto', process.env.TRV_DEV), seen));
      }
    }
  }
  return out;
}

function scanFolder(folder: string, includeTopFolders = new Set<string>()): string[] {
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

function transformFile(file: string): ModuleFile {
  const type = file.endsWith('.d.ts') ? 'd.ts' : (
    file.endsWith('.ts') ? 'ts' : (
      (file.endsWith('.js') || file.endsWith('mjs') || file.endsWith('.cjs')) ? 'js' :
        (file.endsWith('.json') ? 'json' : 'unknown')
    ));
  return [file, type, getNewest(fs.statSync(file))];
}

function describeModule({ name, folder }: Dependency): ModuleShape {
  const files = scanFolder(folder, folder !== CWD ? new Set<string>(['src', 'bin', 'support']) : new Set<string>())
    .reduce<Record<string, ModuleFile[]>>((acc, p) => {
      // Group by top folder
      const rel = p.replace(`${folder}/`, '');
      if (!rel.includes('/')) { // If a file
        if (rel === 'index.ts') {
          acc.index = [transformFile(rel)];
        } else if (rel === 'doc.ts') {
          acc.docIndex = [transformFile(rel)];
        } else {
          (acc['rootFiles'] ??= []).push(transformFile(rel));
        }
      } else {
        const sub = rel.match(/^((?:(test|support)\/resources)|[^/]+)/)![0];
        (acc[sub] ??= []).push(transformFile(rel));
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

function buildManifestModules(): Record<string, ModuleShape> {
  const modules = collectPackages(CWD)
    .filter(x => x.isModule);
  if (process.env.TRV_DEV && !modules.find(x => x.name === '@travetto/cli')) {
    modules.unshift({
      name: '@travetto/cli',
      folder: `${process.env.TRV_DEV}/cli`,
      isModule: true,
    });
  }
  return Object.fromEntries(
    modules.map(x => describeModule(x)).map(m => [m.name, m])
  );
}

export function buildManifest(): ManifestShape {
  return {
    modules: buildManifestModules(),
    generated: Date.now()
  }
}

export function writeManifest(file: string, manifest: ManifestShape): void {
  let folder = file;
  if (file.endsWith('.json')) {
    folder = path.dirname(file);
  } else {
    file = `${folder}/manifest.json`;
  }
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest));
}

export function readManifest(file: string): ManifestShape | undefined {
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

type DeltaModuleFiles = Record<string, ModuleFile>;

function flattenModuleFiles(m: ModuleShape): DeltaModuleFiles {
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

type DeltaEvent = [string, 'added' | 'changed' | 'removed' | 'missing' | 'dirty'];

function deltaModules(outputFolder: string, left: ModuleShape<DeltaModuleFiles>, right: ModuleShape<DeltaModuleFiles>): DeltaEvent[] {
  let out: DeltaEvent[] = [];
  for (const el of Object.keys(left.files)) {
    if (!(el in right)) {
      out.push([el, 'added']);
    } else {
      const [, , leftTs] = left.files[el];
      const [, , rightTs] = right.files[el];
      if (leftTs > rightTs) {
        out.push([el, 'changed']);
      } else {
        try {
          const stat = fs.statSync(`${outputFolder}/${left.output}/${el}`);
          if (getNewest(stat) > leftTs) {
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

export function produceDelta(outputFolder: string, left: ManifestShape, right: ManifestShape): Record<string, DeltaEvent[]> {
  const deltaLeft = Object.fromEntries(
    Object.values(left.modules)
      .map(m => [m.name, { ...m, files: flattenModuleFiles(m) }])
  );

  const deltaRight = Object.fromEntries(
    Object.values(right.modules)
      .map(m => [m.name, { ...m, files: flattenModuleFiles(m) }])
  );

  const out: Record<string, DeltaEvent[]> = {};

  for (const [name, lmod] of Object.entries(deltaLeft)) {
    out[name] = deltaModules(outputFolder, lmod, deltaRight[name])
  }

  return out;
}