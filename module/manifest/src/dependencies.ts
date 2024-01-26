import { PackageUtil } from './package';
import { path } from './path';
import { ManifestContext, ManifestModuleRole, PackageVisitor, PackageVisitReq, Package, ManifestDepCore } from './types';

export type ModuleDep = ManifestDepCore & {
  pkg: Package;
  mainLike?: boolean;
  sourcePath: string;
  childSet: Set<string>;
  parentSet: Set<string>;
  roleSet: Set<ManifestModuleRole>;
  topLevel?: boolean;
};

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class ModuleDependencyVisitor implements PackageVisitor<ModuleDep> {

  constructor(public ctx: ManifestContext) {
    this.#mainSourcePath = path.resolve(this.ctx.workspace.path, this.ctx.main.folder);
  }

  #mainLikeModules = new Set<string>();
  #mainSourcePath: string;

  /**
   * Main source path for searching
   */
  get rootPath(): string {
    return this.#mainSourcePath;
  }

  /**
   * Initialize visitor, and provide global dependencies
   */
  async init(req: PackageVisitReq<ModuleDep>): Promise<PackageVisitReq<ModuleDep>[]> {
    const pkg = PackageUtil.readPackage(req.sourcePath);
    const workspacePkg = PackageUtil.readPackage(this.ctx.workspace.path);

    this.#mainLikeModules = new Set([
      pkg.name,
      ...Object.entries(pkg.travetto?.build?.withModules ?? []).filter(x => x[1] === 'main').map(x => x[0]),
    ]);

    const globals = Object.keys(workspacePkg.travetto?.build?.withModules ?? [])
      .map(name => PackageUtil.packageReq<ModuleDep>(PackageUtil.resolvePackagePath(name), name in (workspacePkg.dependencies ?? {}), true));

    // Capture workspace modules as dependencies
    if (this.ctx.workspace.mono && !this.ctx.main.folder) { // We are at the root of the workspace
      for (const mod of await PackageUtil.resolveWorkspaces(this.ctx)) {
        // Add workspace folders, for tests and docs
        this.#mainLikeModules.add(mod.name);
        globals.push(PackageUtil.packageReq<ModuleDep>(path.resolve(this.ctx.workspace.path, mod.sourcePath), false, true));
      }
    }

    return globals;
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
    const main = name === this.ctx.main.name;
    const mainLike = main || this.#mainLikeModules.has(name);
    const internal = pkg.private === true;
    const local = internal || mainLike || !sourcePath.includes('node_modules');

    const dep: ModuleDep = {
      name, version, sourcePath, main, mainLike, local, internal, pkg: req.pkg,
      parentSet: new Set([]), childSet: new Set([]), roleSet: new Set([]), prod: req.prod, topLevel: req.topLevel
    };

    return dep;
  }

  /**
   * Visit dependency
   */
  visit(req: PackageVisitReq<ModuleDep>, dep: ModuleDep): void {
    const { parent } = req;
    if (parent && dep.name !== this.ctx.main.name) {
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

    const main = mapping.get(this.ctx.main.name)!;

    // Visit all direct dependencies and mark
    for (const { el } of mapping.values()) {
      if (!main.child.has(el.name)) { // Not a direct descendent
        el.prod = false;
      }
      if (main.child.has(el.name) || (el.topLevel && el !== main.el)) { // Direct descendant
        el.roleSet = new Set(el.pkg.travetto?.roles ?? []);
        if (!el.roleSet.size) {
          el.roleSet.add('std');
        }
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