import { PackageUtil } from './package';
import { path } from './path';
import { ManifestContext, ManifestProfile, PackageRel, PackageVisitor, PackageVisitReq, PackageWorkspaceEntry } from './types';

export type Dependency = {
  version: string;
  name: string;
  main?: boolean;
  mainLike?: boolean;
  internal?: boolean;
  sourcePath: string;
  childSet: Map<string, Set<PackageRel>>;
  parentSet: Set<string>;
  profileSet: Set<ManifestProfile>;
};

export class ModuleDependencyVisitor implements PackageVisitor<Dependency> {

  /**
   * Get main patterns for detecting if a module should be treated as main
   */
  static getMainPatternList(rootName: string, workspaces: PackageWorkspaceEntry[], globalModules?: string[]): RegExp[] {
    const groups: Record<string, string[]> = { [rootName]: [] };
    for (const el of [...workspaces.map(x => x.name), ...globalModules ?? []]) {
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

  /**
   *
   */
  static getGlobalDeps(
    rootPath: string,
    workspacePath: string,
    workspaces: PackageWorkspaceEntry[]
  ): PackageVisitReq<Dependency>[] {
    const { travetto: { globalModules = [] } = {} } = PackageUtil.readPackage(workspacePath);

    return [
      ...globalModules.map(f => PackageUtil.resolvePackagePath(rootPath, f, '*')),
      ...workspaces.map(entry => path.resolve(rootPath, entry.sourcePath))
    ].map(sourcePath => ({
      sourcePath,
      pkg: PackageUtil.readPackage(sourcePath),
      rel: 'dev'
    }));
  }

  constructor(public ctx: ManifestContext) { }

  #mainPatterns: RegExp[] = [];

  /**
   * Initialize visitor, and provide global dependencies
   */
  async init(): Promise<PackageVisitReq<Dependency>[]> {
    const rootFolder = this.ctx.mainPath;
    const pkg = PackageUtil.readPackage(rootFolder);
    const workspaces = pkg.workspaces?.length ? (await PackageUtil.resolveWorkspaces(rootFolder)) : [];

    this.#mainPatterns = ModuleDependencyVisitor.getMainPatternList(pkg.name, workspaces, pkg.travetto?.globalModules);
    return this.ctx.monoRepo ? ModuleDependencyVisitor.getGlobalDeps(
      rootFolder,
      this.ctx.workspacePath,
      workspaces
    ) : [];
  }

  /**
   * Is valid dependency for searching
   */
  valid(req: PackageVisitReq<Dependency>): boolean {
    return req.sourcePath === path.cwd() || (
      req.rel !== 'peer' &&
      !!req.pkg.travetto &&
      !req.pkg.travetto?.isolated
    );
  }

  /**
   * Create dependency from request
   */
  create(req: PackageVisitReq<Dependency>): Dependency {
    const { pkg: { name, version, travetto: { profiles = [] } = {}, ...pkg }, sourcePath: reqPath } = req;
    const profileSet = new Set<ManifestProfile>([
      ...profiles ?? []
    ]);
    return {
      name,
      version,
      sourcePath: reqPath,
      main: this.ctx.mainPath === req.sourcePath,
      mainLike: this.#mainPatterns.some(x => x.test(name)),
      internal: pkg.private === true,
      parentSet: new Set([]),
      childSet: new Map(),
      profileSet
    };
  }

  /**
   * Visit dependency
   */
  visit(req: PackageVisitReq<Dependency>, dep: Dependency): void {
    const { parent } = req;
    if (parent) {
      dep.parentSet.add(parent.name);
      const set = parent.childSet.get(dep.name) ?? new Set();
      parent.childSet.set(dep.name, set);
      set.add(req.rel);
    }
  }

  /**
   * Propagate profile/relationship information through graph
   */
  complete(deps: Set<Dependency>): Set<Dependency> {
    const mapping = new Map<string, { parent: Set<string>, child: Map<string, Set<PackageRel>>, el: Dependency }>();
    for (const el of deps) {
      mapping.set(el.name, { parent: new Set(el.parentSet), child: new Map(el.childSet), el });
    }

    const main = mapping.get(this.ctx.mainModule)!;

    // Visit all direct dependencies and mark
    for (const [name, relSet] of main.child) {
      const childDep = mapping.get(name)!.el;
      if (!relSet.has('dev')) {
        childDep.profileSet.add('std');
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