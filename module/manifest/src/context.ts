import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { Package } from './types/package';
import type { ManifestContext } from './types/context';

type Pkg = Package & { path: string };

// eslint-disable-next-line no-bitwise
const toPort = (pth: string): number => (Math.abs([...pth].reduce((a, b) => (a * 33) ^ b.charCodeAt(0), 5381)) % 29000) + 20000;
const toPosix = (pth: string): string => pth.replaceAll('\\', '/');
const readPackage = (file: string): Pkg => ({ ...JSON.parse(readFileSync(file, 'utf8')), path: toPosix(path.dirname(file)) });

/** Find package */
function findPackage(base: string, pred: (_p?: Pkg) => boolean): Pkg {
  let folder = `${base}/.`;
  let prev: string;
  let pkg: Pkg | undefined;

  do {
    prev = folder;
    folder = path.dirname(folder);
    const folderPkg = path.resolve(folder, 'package.json');
    pkg = existsSync(folderPkg) ? readPackage(folderPkg) : pkg;
  } while (
    prev !== folder && // Not at root
    !pred(pkg) && // Matches criteria
    !existsSync(path.resolve(folder, '.git')) // Not at source root
  );

  if (!pkg) {
    throw new Error('Could not find a package.json');
  }

  return pkg;
}

/**
 * Gets build context
 */
export function getManifestContext(root: string = process.cwd()): ManifestContext {
  const workspace = findPackage(root, pkg => !!pkg?.workspaces || !!pkg?.travetto?.build?.isolated);
  const build = workspace.travetto?.build ?? {};
  const resolve = createRequire(path.resolve(workspace.path, 'node_modules')).resolve.bind(null);
  const wsPrefix = `${workspace.path}/`;
  const modPkg = (!!workspace.workspaces && process.env.TRV_MODULE) ?
    readPackage(resolve(`${process.env.TRV_MODULE}/package.json`)) :
    findPackage(root, pkg => !!pkg) ?? workspace;

  return {
    workspace: {
      name: workspace.name ?? 'untitled',
      path: workspace.path,
      mono: !!workspace.workspaces,
      manager: existsSync(path.resolve(workspace.path, 'yarn.lock')) ? 'yarn' : 'npm',
      type: workspace.type ?? 'commonjs',
      defaultEnv: workspace.travetto?.defaultEnv ?? 'local'
    },
    build: {
      compilerUrl: build.compilerUrl ?? `http://localhost:${toPort(wsPrefix)}`,
      compilerModuleFolder: toPosix(path.dirname(resolve('@travetto/compiler/package.json'))).replace(wsPrefix, ''),
      compilerFolder: toPosix(build.compilerFolder ?? '.trv/compiler'),
      outputFolder: toPosix(build.outputFolder ?? '.trv/output'),
      toolFolder: toPosix(build.toolFolder ?? '.trv/tool'),
      typesFolder: toPosix(build.typesFolder ?? '.trv/types')
    },
    main: {
      name: modPkg.name ?? 'untitled',
      folder: modPkg.path.replace(wsPrefix, ''),
      version: modPkg.version,
      description: modPkg.description
    }
  };
}