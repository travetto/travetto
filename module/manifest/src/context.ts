import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { type Package, PACKAGE_MANAGERS } from './types/package.ts';
import type { ManifestContext } from './types/context.ts';

type Pkg = Package & { path: string };

// eslint-disable-next-line no-bitwise
const toPort = (location: string): number => (Math.abs([...location].reduce((a, b) => (a * 33) ^ b.charCodeAt(0), 5381)) % 29000) + 20000;
const toPosix = (location: string): string => location.replaceAll('\\', '/');
const readPackage = (file: string): Pkg => ({ ...JSON.parse(readFileSync(file, 'utf8')), path: toPosix(path.dirname(file)) });

/** Find package */
function findPackage(base: string, pred: (_p: Pkg) => boolean): Pkg {
  let folder = `${base}/.`;
  let previous: string;
  let pkg: Pkg | undefined;
  const packages: Pkg[] = [];

  do {
    pkg && packages.push(pkg);
    previous = folder;
    folder = path.dirname(folder);
    const folderPkg = path.resolve(folder, 'package.json');
    pkg = existsSync(folderPkg) ? readPackage(folderPkg) : pkg;
  } while (
    previous !== folder && // Not at root
    (!pkg || !pred(pkg)) && // Matches criteria
    !existsSync(path.resolve(folder, '.git')) // Not at source root
  );

  if (!pkg) {
    throw new Error('Could not find a package.json');
  } else if (!pred(pkg) && packages.length) {
    // We never matched, lets fallback to the first package.json found
    pkg = packages[0];
  }

  return pkg;
}

/**
 * Gets build context
 */
export function getManifestContext(root: string = process.cwd()): ManifestContext {
  const workspace = findPackage(root, pkg =>
    !!pkg.travetto?.build?.isolated ||
    Object.values(PACKAGE_MANAGERS).some(manager => manager.isWorkspace(pkg))
  );
  if (workspace.type !== 'module') {
    throw new Error('Only ESM modules are supported, package.json must be of type module');
  }

  const build = workspace.travetto?.build ?? {};
  const resolve = createRequire(path.resolve(workspace.path, 'node_modules')).resolve.bind(null);
  const wsPrefix = `${workspace.path}/`;
  const moduleName = process.env.TRV_MODULE === workspace.name ? workspace.path : process.env.TRV_MODULE;
  const modulePkg = (!!workspace.workspaces && moduleName) ?
    readPackage(resolve(`${moduleName}/package.json`)) :
    findPackage(root, pkg => !!pkg) ?? workspace;

  return {
    workspace: {
      name: workspace.name ?? 'untitled',
      path: workspace.path,
      mono: !!workspace.workspaces,
      manager: Object.values(PACKAGE_MANAGERS).find(item => item.isActive(workspace))?.type ?? 'npm'
    },
    build: {
      compilerUrl: build.compilerUrl ?? `http://localhost:${toPort(wsPrefix)}`,
      outputFolder: toPosix(build.outputFolder ?? '.trv/output'),
      toolFolder: toPosix(build.toolFolder ?? '.trv/tool'),
      typesFolder: toPosix(build.typesFolder ?? '.trv/types')
    },
    main: {
      name: modulePkg.name ?? 'untitled',
      folder: modulePkg.path.replace(wsPrefix, ''),
      version: modulePkg.version,
      description: modulePkg.description
    }
  };
}