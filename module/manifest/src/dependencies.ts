import { PackageUtil } from './package';
import { path } from './path';
import { ManifestContext, ManifestModuleRole, PackageVisitor, PackageVisitReq, Package } from './types';

export type ModuleDep = {
  pkg: Package;
  version: string;
  name: string;
  main?: boolean;
  mainSource?: boolean;
  local?: boolean;
  internal?: boolean;
  sourcePath: string;
  childSet: Set<string>;
  parentSet: Set<string>;
  roleSet: Set<ManifestModuleRole>;
  prod: boolean;
  topLevel?: boolean;
};

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class ModuleDependencyVisitor implements PackageVisitor<ModuleDep> {

  /**
   * Get main patterns for detecting if a module should be treated as main
   */
  static getMainPatterns(mainModule: string, mergeModules: string[]): RegExp[] {
    const groups: Record<string, string[]> = { [mainModule]: [] };
    for (const el of mergeModules) {
      if (el.includes('/')) {
        const [grp, sub] = el.split('/');
        (groups[`${grp}/`] ??= []).push(sub);
      } else {
        (groups[el] ??= []);
      }
    }

    return Object.entries(groups)
      .map(([root, subs]) => subs.length ? `${root}(${subs.join('|')})` : root)
      .map(x => new RegExp(`^${x.replace(/[*]/g, '.*?')}$`));
  }

  constructor(public ctx: ManifestContext) {
    this.#mainSourcePath = path.resolve(this.ctx.workspacePath, this.ctx.mainFolder);
  }

  #mainPatterns: RegExp[] = [];
  #mainSourcePath: string;

  /**
   * Initialize visitor, and provide global dependencies
   */
  async init(req: PackageVisitReq<ModuleDep>): Promise<PackageVisitReq<ModuleDep>[]> {
    const pkg = PackageUtil.readPackage(req.sourcePath);
    const workspacePkg = PackageUtil.readPackage(this.ctx.workspacePath);
    const workspaceModules = pkg.workspaces?.length ? (await PackageUtil.resolveWorkspaces(this.ctx, req.sourcePath)) : [];

    this.#mainPatterns = ModuleDependencyVisitor.getMainPatterns(pkg.name, [
      ...pkg.travetto?.mainSource ?? [],
      // Add workspace folders, for tests and docs
      ...workspaceModules.map(x => x.name)
    ]);

    const globals = (workspacePkg.travetto?.globalModules ?? [])
      .map(name => PackageUtil.packageReq<ModuleDep>(PackageUtil.resolvePackagePath(name), name in (workspacePkg.dependencies ?? {}), true));

    const workspaceModuleDeps = workspaceModules
      .map(entry => PackageUtil.packageReq<ModuleDep>(path.resolve(req.sourcePath, entry.sourcePath), false, true));

    return [...globals, ...workspaceModuleDeps];
  }

  /**
   * Is valid dependency for searching
   */
  valid(req: PackageVisitReq<ModuleDep>): boolean {
    return req.sourcePath === this.#mainSourcePath || (
      (!!req.pkg.travetto || req.pkg.private === true || !req.sourcePath.includes('node_modules'))
    );
  }

  /**
   * Create dependency from request
   */
  create(req: PackageVisitReq<ModuleDep>): ModuleDep {
    const { pkg, sourcePath } = req;
    const { name, version } = pkg;
    const main = name === this.ctx.mainModule;
    const mainSource = main || this.#mainPatterns.some(x => x.test(name));
    const internal = pkg.private === true;
    const local = internal || mainSource || !sourcePath.includes('node_modules');

    const dep = {
      name, version, sourcePath, main, mainSource, local, internal, pkg: req.pkg,
      parentSet: new Set([]), childSet: new Set([]), roleSet: new Set([]), prod: req.prod, topLevel: req.topLevel
    };

    return dep;
  }

  /**
   * Visit dependency
   */
  visit(req: PackageVisitReq<ModuleDep>, dep: ModuleDep): void {
    const { parent } = req;
    if (parent && dep.name !== this.ctx.mainModule) {
      dep.parentSet.add(parent.name);
      parent.childSet.add(dep.name);
    }
  }

  /**
   * Propagate prod, role information through graph
   */
  complete(deps: Set<ModuleDep>): Set<ModuleDep> {
    const mapping = new Map<string, { parent: Set<string>, child: Set<string>, el: ModuleDep }>();
    for (const el of deps) {
      mapping.set(el.name, { parent: new Set(el.parentSet), child: new Set(el.childSet), el });
    }

    const main = mapping.get(this.ctx.mainModule)!;

    // Visit all direct dependencies and mark
    for (const { el } of mapping.values()) {
      if (el.topLevel) {
        el.roleSet = new Set(el.pkg.travetto?.roles ?? []);
        if (!el.roleSet.size) {
          el.roleSet.add('std');
        }
      } else if (!main.child.has(el.name)) { // Not a direct descendent
        el.prod = false;
      }
    }

    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      if (!toProcess.length) {
        throw new Error(`We have reached a cycle for ${[...mapping.keys()]}`);
      }
      // Propagate
      for (const { el, child } of toProcess) {
        for (const c of child.keys()) {
          const { el: cDep, parent } = mapping.get(c)!;
          parent.delete(el.name); // Remove from child
          for (const role of el.roleSet) {
            cDep.roleSet.add(role);
          }
          cDep.prod ||= el.prod; // Allow prod to trickle down as needed
        }
      }
      // Remove from mapping
      for (const { el } of toProcess) {
        mapping.delete(el.name);
      }
    }

    // Color parent as final step
    main.el.prod = true;
    main.el.roleSet.add('std');

    return deps;
  }
}