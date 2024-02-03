import { PackageUtil } from './package';
import { path } from './path';

import type { Package, PackageDepType, PackageVisitReq, PackageVisitor } from './types/package';
import type { ManifestContext } from './types/context';
import type { PackageModule } from './types/manifest';

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class PackageModuleVisitor implements PackageVisitor<PackageModule> {

  constructor(public ctx: ManifestContext) {
    this.#mainSourcePath = path.resolve(this.ctx.workspace.path, this.ctx.main.folder);
  }

  #mainSourcePath: string;
  #cache: Record<string, PackageModule> = {};
  #workspaceModules: Map<string, string>;

  /**
   * Initialize visitor, and provide global dependencies
   */
  async init(): Promise<Iterable<PackageVisitReq<PackageModule>>> {
    this.#workspaceModules = new Map(
      (await PackageUtil.resolveWorkspaces(this.ctx)).map(x => [x.name, x.path])
    );
    const root = PackageUtil.readPackage(this.ctx.workspace.path);
    const main = PackageUtil.readPackage(this.#mainSourcePath);
    const globals = [this.create(main, { prod: true, main: true })];

    // Capture workspace modules as dependencies when at the mono root
    if (this.ctx.workspace.mono && !this.ctx.main.folder) {
      globals.push(
        ...[...this.#workspaceModules.values()]
          .map(x => PackageUtil.readPackage(x))
          .map(p => this.create(p, { main: true }))
      );
    }

    // If we have 'withModules'
    for (const [name, type] of Object.entries(root.travetto?.build?.withModules ?? {})) {
      const req = this.create(
        PackageUtil.readPackage(PackageUtil.resolvePackagePath(name)),
        { main: type === 'main', workspace: true }
      );
      req.value.state.withMainParentSet.add(main.name);
      globals.push(req);
    }

    return globals;
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
  create(pkg: Package, { main, workspace, prod = false }: Partial<PackageModule> = {}): PackageVisitReq<PackageModule> {
    const sourcePath = PackageUtil.getPackagePath(pkg);
    const value = this.#cache[sourcePath] ??= {
      main,
      prod,
      name: pkg.name,
      version: pkg.version,
      workspace: workspace ?? this.#workspaceModules.has(pkg.name),
      internal: pkg.private === true,
      sourceFolder: sourcePath === this.ctx.workspace.path ? '' : sourcePath.replace(`${this.ctx.workspace.path}/`, ''),
      outputFolder: `node_modules/${pkg.name}`,
      state: {
        childSet: new Set(), parentSet: new Set(), roleSet: new Set(), withMainParentSet: new Set(),
        travetto: pkg.travetto, prodDeps: new Set(Object.keys(pkg.dependencies ?? {}))
      }
    };

    const deps: PackageDepType[] = ['dependencies', ...(value.main ? ['devDependencies'] as const : [])];

    return {
      pkg, value,
      children: Object.fromEntries(deps.flatMap(x => Object.entries(pkg[x] ?? {})))
    };
  }

  /**
   * Visit dependency
   */
  visit({ value: mod, parent }: PackageVisitReq<PackageModule>): void {
    if (mod.main) { return; }
    if (parent) {
      mod.state.parentSet.add(parent.name);
      parent.state.childSet.add(mod.name);
    }
  }

  /**
   * Propagate prod, role information through graph
   */
  async complete(mods: Iterable<PackageModule>): Promise<PackageModule[]> {
    const mapping = new Map<string, { parent: Set<string>, el: PackageModule }>();
    for (const el of mods) {
      mapping.set(el.name, { parent: new Set(el.state.parentSet), el });
    }

    // Setup roles and prod flag for main modules dependencies
    for (const el of mods) {
      if (el.main) {
        // Paint the top level dependencies as they will set the role status
        for (const child of el.state.childSet) {
          const { el: cDep } = mapping.get(child)!;
          for (const role of cDep.state.travetto?.roles ?? ['std']) {
            cDep.state.roleSet.add(role);
          }
        }
      }
    }

    // Visit all nodes
    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      if (!toProcess.length) {
        throw new Error(`We have reached a cycle for ${[...mapping.keys()]}`);
      }
      // Propagate to children
      for (const { el } of toProcess) {
        for (const c of el.state.childSet) {
          const { el: cDep, parent } = mapping.get(c)!;
          parent.delete(el.name); // Remove from child
          for (const role of el.state.roleSet) {
            cDep.state.roleSet.add(role); // Transfer roles
          }
          cDep.prod ||= (el.prod && el.state.prodDeps.has(c)); // Allow prod to trickle down as needed
        }
      }
      // Remove from mapping
      for (const { el } of toProcess) {
        mapping.delete(el.name);
      }
    }

    // Mark as standard at the end
    for (const el of mods) {
      if (el.main) {
        el.state.roleSet.add('std');
        for (const p of el.state.withMainParentSet) {
          el.state.parentSet.add(p);
        }
      }
    }

    return [...mods].sort((a, b) => a.name.localeCompare(b.name));
  }
}