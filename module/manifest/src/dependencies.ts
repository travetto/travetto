import { PackageUtil } from './package';
import { path } from './path';

import type { Package, PackageDepType, PackageVisitReq, PackageVisitor } from './types/package';
import type { ManifestContext } from './types/context';
import type { PackageModule } from './types/manifest';

type CreateOpts = Partial<Record<'main' | 'workspace' | 'prod' | 'ignoreRoles', boolean>>;

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class PackageModuleVisitor implements PackageVisitor<PackageModule> {

  constructor(public ctx: ManifestContext) {
    this.#mainSourcePath = path.resolve(this.ctx.workspace.path, this.ctx.main.folder);
  }

  #mainSourcePath: string;
  #cache: Record<string, PackageModule> = {};

  /**
   * Initialize visitor, and provide global dependencies
   */
  async init(): Promise<Iterable<PackageVisitReq<PackageModule>>> {
    const mainPkg = PackageUtil.readPackage(this.#mainSourcePath);
    const mainReq = this.create(mainPkg, { main: true, workspace: true, ignoreRoles: true, prod: true });
    const globals = [mainReq];

    // Treat all workspace modules as main modules
    if (this.ctx.workspace.mono && !this.ctx.main.folder) {
      const workspaceModules = new Map(
        (await PackageUtil.resolveWorkspaces(this.ctx)).map(x => [x.name, x.path])
      );
      for (const [, loc] of workspaceModules) {
        globals.push(this.create(
          PackageUtil.readPackage(loc),
          { main: true, workspace: true, ignoreRoles: true }
        ));
      }
    } else {
      // If we have 'withModules' at workspace root
      const root = PackageUtil.readPackage(this.ctx.workspace.path);
      for (const [name, type] of Object.entries(root.travetto?.build?.withModules ?? {})) {
        globals.push(this.create(
          PackageUtil.readPackage(PackageUtil.resolvePackagePath(name)),
          { main: type === 'main', workspace: true }
        ));
      }
    }

    return globals.map((x, i) => i === 0 ? x : { ...x, parent: mainReq.value });
  }

  /**
   * Is valid dependency for searching
   */
  valid({ value: node }: PackageVisitReq<PackageModule>): boolean {
    return node.workspace || !!node.state.travetto; // Workspace or travetto module
  }

  /**
   * Build a package module
   */
  create(pkg: Package, { main, workspace, prod = false, ignoreRoles }: CreateOpts = {}): PackageVisitReq<PackageModule> {
    const sourcePath = PackageUtil.getPackagePath(pkg);
    const value = this.#cache[sourcePath] ??= {
      main,
      prod,
      name: pkg.name,
      version: pkg.version,
      workspace,
      internal: pkg.private === true,
      sourceFolder: sourcePath === this.ctx.workspace.path ? '' : sourcePath.replace(`${this.ctx.workspace.path}/`, ''),
      outputFolder: `node_modules/${pkg.name}`,
      state: {
        childSet: new Set(), parentSet: new Set(), roleSet: new Set(),
        travetto: pkg.travetto, prodDeps: new Set(Object.keys(pkg.dependencies ?? {})),
        ignoreRoles: !!ignoreRoles,
      }
    };

    const deps: PackageDepType[] = ['dependencies', ...(value.main ? ['devDependencies'] as const : [])];
    const children = Object.fromEntries(deps.flatMap(x => Object.entries(pkg[x] ?? {})));
    return { pkg, value, children };
  }

  /**
   * Visit dependency
   */
  visit({ value: mod, parent }: PackageVisitReq<PackageModule>): void {
    if (parent) {
      mod.state.parentSet.add(parent.name);
      parent.state.childSet.add(mod.name);
    }
  }

  /**
   * Propagate prod, role information through graph
   */
  async complete(mods: Iterable<PackageModule>): Promise<PackageModule[]> {
    const main = [...mods].find(x => x.name === this.ctx.main.name)!;
    for (const el of mods) {
      el.state.childSet.delete(main.name); // Remove main as a child dependency
      if (el.name !== main.name) {
        el.state.childSet.delete(main.name);
      } else {
        el.state.parentSet.clear();
      }
    }

    const mapping = new Map([...mods].map(el => [el.name, { parent: new Set(el.state.parentSet), el }]));

    // All first-level dependencies should have role filled in (for propagation)
    for (const dep of [...mods].filter(x => x.state.ignoreRoles)) {
      for (const c of dep.state.childSet) { // Visit children
        const cDep = mapping.get(c)!.el;
        if (cDep.state.ignoreRoles) { continue; }
        // Set roles for all top level modules
        for (const role of cDep.state.travetto?.roles ?? ['std']) {
          cDep.state.roleSet.add(role);
        }
      }
    }

    // Visit all nodes
    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      if (!toProcess.length) {
        throw new Error(`We have reached a cycle for ${[...mapping.keys()].join('\n')}`);
      }
      // Propagate to children
      for (const { el } of toProcess) {
        for (const c of el.state.childSet) {
          const child = mapping.get(c);
          if (!child) { continue; }
          child.parent.delete(el.name);
          // Propagate roles from parent to child
          if (!child.el.state.ignoreRoles) {
            for (const role of el.state.roleSet) {
              child.el.state.roleSet.add(role);
            }
          }
          // Allow prod to trickle down as needed
          child.el.prod ||= (el.prod && el.state.prodDeps.has(c));
        }
      }
      // Remove from mapping
      for (const { el } of toProcess) {
        mapping.delete(el.name);
      }
    }

    // Mark as standard at the end
    for (const dep of [...mods].filter(x => x.state.ignoreRoles)) {
      dep.state.roleSet.clear(); // Ensure all ignore roles are std only
      dep.state.roleSet.add('std');
    }

    return [...mods].sort((a, b) => a.name.localeCompare(b.name));
  }
}