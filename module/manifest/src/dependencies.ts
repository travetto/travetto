import { PackageUtil } from './package';
import { path } from './path';
import { ManifestContext, ManifestModuleProfile, PackageRel, PackageVisitor, PackageVisitReq } from './types';

export type ModuleDep = {
  version: string;
  name: string;
  main?: boolean;
  mainSource?: boolean;
  local?: boolean;
  internal?: boolean;
  sourcePath: string;
  childSet: Map<string, Set<PackageRel>>;
  parentSet: Set<string>;
  profileSet: Set<ManifestModuleProfile>;
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

    const globals = [
      ...(workspacePkg.travetto?.globalModules ?? []),
      ...(pkg.travetto?.globalModules ?? [])
    ]
      .map(f => PackageUtil.resolvePackagePath(f));

    const workspaceModuleDeps = workspaceModules
      .map(entry => path.resolve(req.sourcePath, entry.sourcePath));

    return [
      ...globals,
      ...workspaceModuleDeps
    ].map(s => PackageUtil.packageReq(s, 'global'));
  }

  /**
   * Is valid dependency for searching
   */
  valid(req: PackageVisitReq<ModuleDep>): boolean {
    return req.sourcePath === this.#mainSourcePath || (
      req.rel !== 'peer' &&
      (!!req.pkg.travetto || req.pkg.private === true || !req.sourcePath.includes('node_modules') || req.rel === 'global')
    );
  }

  /**
   * Create dependency from request
   */
  create(req: PackageVisitReq<ModuleDep>): ModuleDep {
    const { pkg: { name, version, travetto: { profiles = [] } = {}, ...pkg }, sourcePath } = req;
    const profileSet = new Set<ManifestModuleProfile>([
      ...profiles ?? []
    ]);
    const main = name === this.ctx.mainModule;
    const mainSource = main || this.#mainPatterns.some(x => x.test(name));
    const internal = pkg.private === true;
    const local = internal || mainSource || !sourcePath.includes('node_modules');

    const dep = {
      name, version, sourcePath, main, mainSource, local, internal,
      parentSet: new Set([]), childSet: new Map(), profileSet
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
      const set = parent.childSet.get(dep.name) ?? new Set();
      parent.childSet.set(dep.name, set);
      set.add(req.rel);
    }
  }

  /**
   * Propagate profile/relationship information through graph
   */
  complete(deps: Set<ModuleDep>): Set<ModuleDep> {
    const mapping = new Map<string, { parent: Set<string>, child: Map<string, Set<PackageRel>>, el: ModuleDep }>();
    for (const el of deps) {
      mapping.set(el.name, { parent: new Set(el.parentSet), child: new Map(el.childSet), el });
    }

    const main = mapping.get(this.ctx.mainModule)!;

    // Visit all direct dependencies and mark
    for (const [name, relSet] of main.child) {
      const childDep = mapping.get(name)!.el;
      if (!relSet.has('dev')) {
        childDep.profileSet.add('std');
      } else {
        childDep.profileSet.add('dev');
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
          for (const prof of el.profileSet) {
            cDep.profileSet.add(prof);
          }
        }
      }
      // Remove from mapping
      for (const { el } of toProcess) {
        mapping.delete(el.name);
      }
    }

    // Color the main folder as std
    main.el.profileSet.add('std');
    return deps;
  }
}