import { PackageUtil } from './package';
import { path } from './path';
import {
  ManifestContext, ManifestProfile, PackageRel,
  PackageVisitor, PackageVisitReq, PackageWorkspaceEntry
} from './types';

export type Dependency = {
  version: string;
  name: string;
  main?: boolean;
  internal?: boolean;
  folder: string;
  childSet: Set<string>;
  parentSet: Set<string>;
  profileSet: Set<ManifestProfile>;
};

export class ModuleDependencyVisitor implements PackageVisitor<Dependency> {

  /**
   * Get main patterns for detecting if a module should be treated as main
   */
  static getMainPatternList(rootName: string, workspaces: PackageWorkspaceEntry[], mergeWith?: string[]): RegExp[] {
    const groups: Record<string, string[]> = { [rootName]: [] };
    for (const el of [...workspaces.map(x => x.name), ...mergeWith ?? []]) {
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
   * @param rootFolder 
   * @param workspacePath 
   * @param workspaces 
   * @param globalModules 
   * @returns 
   */
  static getGlobalDeps(
    rootFolder: string,
    workspacePath: string,
    workspaces: PackageWorkspaceEntry[]
  ): PackageVisitReq<Dependency>[] {
    const { travettoRepo: { globalModules = [] } = {} } = PackageUtil.readPackage(workspacePath);

    return [
      ...globalModules.map(f => path.resolve(workspacePath, f)),
      ...workspaces.map(entry => path.resolve(rootFolder, entry.folder))
    ].map(folder => ({
      folder,
      pkg: PackageUtil.readPackage(folder),
      rel: 'dev' as PackageRel
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

    this.#mainPatterns = ModuleDependencyVisitor.getMainPatternList(pkg.name, workspaces, pkg.travetto?.mergeWith);
    return this.ctx.monoRepo ? ModuleDependencyVisitor.getGlobalDeps(rootFolder, this.ctx.workspacePath, workspaces) : [];
  }

  /**
   * Is valid dependency for searching
   */
  valid(req: PackageVisitReq<Dependency>): boolean {
    return req.folder === path.cwd() || req.rel === 'direct' || (
      req.rel !== 'peer' && req.rel !== 'opt' &&
      !!req.pkg.travetto &&
      !req.pkg.travetto?.isolated
    );
  }

  /**
   * Create dependency from request
   */
  create(req: PackageVisitReq<Dependency>): Dependency {
    const { pkg: { name, version, travetto: { profiles = [] } = {}, ...pkg }, folder } = req;
    return {
      name,
      version,
      folder,
      main: this.#mainPatterns.some(x => x.test(name)),
      internal: pkg.private === true,
      parentSet: new Set([]),
      childSet: new Set<string>(),
      profileSet: new Set<ManifestProfile>(profiles)
    };
  }

  /**
   * Visit dependency
   */
  visit(req: PackageVisitReq<Dependency>, dep: Dependency): void {
    const { parent } = req;
    if (parent) {
      dep.parentSet.add(parent.name);
      parent.childSet.add(dep.name);
    }
  }

  /**
   * Propagate profile/relationship information through graph
   */
  complete(deps: Set<Dependency>): Set<Dependency> {
    const mapping = new Map<string, { parent: Set<string>, child: Set<string>, el: Dependency }>();
    for (const el of deps) {
      mapping.set(el.name, { parent: new Set(el.parentSet), child: new Set(el.childSet), el });
    }

    mapping.get(this.ctx.mainModule)?.el.profileSet.add('root');

    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      // Propagate
      for (const { el, child } of toProcess) {
        for (const c of child) {
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

    return deps;
  }
}