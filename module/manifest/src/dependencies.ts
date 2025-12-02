import { PackageUtil } from './package.ts';
import { path } from './path.ts';

import type { Package, PackageDepType } from './types/package.ts';
import type { ManifestContext } from './types/context.ts';
import type { PackageModule } from './types/manifest.ts';

type CreateOpts = Partial<Pick<PackageModule, 'main' | 'workspace' | 'prod'>> & { roleRoot?: boolean, parent?: PackageModule };

type Req = {
  /** Request package */
  pkg: Package;
  /** Children to visit */
  children: Record<string, string>;
  /** Value */
  value: PackageModule;
  /** Parent */
  parent?: PackageModule;
};

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class PackageModuleVisitor {

  static async visit(ctx: ManifestContext): Promise<Iterable<PackageModule>> {
    const visitor = new PackageModuleVisitor(ctx, Object.fromEntries((await PackageUtil.resolveWorkspaces(ctx)).map(x => [x.name, x.path])));
    return visitor.visit();
  }

  #mainSourcePath: string;
  #cache: Record<string, PackageModule> = {};
  #workspaceModules: Record<string, string>;
  #ctx: ManifestContext;

  constructor(ctx: ManifestContext, workspaceModules: Record<string, string>) {
    this.#mainSourcePath = path.resolve(ctx.workspace.path, ctx.main.folder);
    this.#ctx = ctx;
    this.#workspaceModules = workspaceModules;
  }

  /**
   * Build a package module
   */
  #create(sourcePath: string, { main, workspace, prod = false, roleRoot = false, parent }: CreateOpts = {}): Req {
    const pkg = PackageUtil.readPackage(sourcePath);
    const value = this.#cache[sourcePath] ??= {
      main,
      prod,
      name: pkg.name,
      version: pkg.version,
      workspace: workspace ?? (pkg.name in this.#workspaceModules),
      internal: pkg.private === true,
      sourceFolder: sourcePath === this.#ctx.workspace.path ? '' : sourcePath.replace(`${this.#ctx.workspace.path}/`, ''),
      outputFolder: `node_modules/${pkg.name}`,
      state: {
        childSet: new Set(), parentSet: new Set(), roleSet: new Set(), roleRoot,
        travetto: pkg.travetto, prodDeps: new Set(Object.keys(pkg.dependencies ?? {}))
      }
    };

    const deps: PackageDepType[] = ['dependencies', ...(value.main ? ['devDependencies'] as const : [])];
    const children = Object.fromEntries(deps.flatMap(x => Object.entries(pkg[x] ?? {})));
    return { pkg, value, children, parent };
  }

  /**
   * Get monorepo root includes
   */
  #getMonoRootIncludes(parent: Req): Req[] {
    if (!(this.#ctx.workspace.mono && !this.#ctx.main.folder)) { // If not mono root, bail
      return [];
    }

    return Object.values(this.#workspaceModules)
      .map(loc => this.#create(loc, { main: true, workspace: true, roleRoot: true, parent: parent.value }));
  }

  /**
   * Determine default includes
   */
  #getIncludes(parent: Req): Req[] {
    if (this.#ctx.workspace.mono && !this.#ctx.main.folder) { // If mono and not at mono root, bail
      return [];
    }

    const root = PackageUtil.readPackage(this.#ctx.workspace.path);
    if (root.travetto?.build?.includes) {
      return Object.entries(root.travetto.build.includes).map(([name, type]) =>
        this.#create(PackageUtil.resolvePackagePath(name), { main: type === 'main', workspace: true, parent: parent.value })
      );
    } else {
      return Object.values(this.#workspaceModules)
        .filter((loc) => PackageUtil.readPackage(loc).travetto?.workspaceInclude)
        .map(loc => this.#create(loc, { workspace: true, parent: parent.value }));
    }
  }

  /**
   * Propagate prod, role information through graph
   */
  async #complete(mods: Iterable<PackageModule>): Promise<PackageModule[]> {
    const mapping = new Map([...mods].map(item => [item.name, { parent: new Set(item.state.parentSet), item }]));

    // All first-level dependencies should have role filled in (for propagation)
    for (const dependency of [...mods].filter(x => x.state.roleRoot)) {
      dependency.state.roleSet.clear(); // Ensure the roleRoot is empty
      for (const child of dependency.state.childSet) { // Visit children
        const childDependency = mapping.get(child)!.item;
        if (childDependency.state.roleRoot) { continue; }
        // Set roles for all top level modules
        childDependency.state.roleSet = new Set(childDependency.state.travetto?.roles ?? ['std']);
      }
    }

    // Visit all nodes
    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      if (!toProcess.length) {
        throw new Error(`We have reached a cycle for ${[...mapping.keys()]}`);
      }
      // Propagate to children
      for (const { item } of toProcess) {
        for (const c of item.state.childSet) {
          const child = mapping.get(c);
          if (!child) { continue; }
          child.parent.delete(item.name);
          // Propagate roles from parent to child
          if (!child.item.state.roleRoot) {
            for (const role of item.state.roleSet) {
              child.item.state.roleSet.add(role);
            }
          }
          // Allow prod to trickle down as needed
          child.item.prod ||= (item.prod && item.state.prodDeps.has(c));
        }
      }
      // Remove from mapping
      for (const { item } of toProcess) {
        mapping.delete(item.name);
      }
    }

    // Mark as standard at the end
    for (const dependency of [...mods].filter(x => x.state.roleRoot)) {
      dependency.state.roleSet = new Set(['std']);
    }

    return [...mods].toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Visit packages with ability to track duplicates
   */
  async visit(): Promise<Iterable<PackageModule>> {
    const seen = new Set<PackageModule>();
    const mainReq = this.#create(this.#mainSourcePath, { main: true, workspace: true, roleRoot: true, prod: true });

    const queue = [
      mainReq,
      ...this.#getMonoRootIncludes(mainReq),
      ...this.#getIncludes(mainReq)
    ];

    while (queue.length) {
      const { value: node, parent, children, pkg } = queue.shift()!; // Visit initial set first
      if (!node || (!node.workspace && !node.state.travetto)) {
        continue;
      }

      // Track parentage
      if (node.name !== this.#ctx.main.name && parent) {
        node.state.parentSet.add(parent.name);
        parent.state.childSet.add(node.name);
      }

      if (seen.has(node)) {
        continue;
      } else {
        seen.add(node);
      }

      const next = Object.entries(children)
        .map(([n, location]) => PackageUtil.resolveVersionPath(pkg, location) ?? PackageUtil.resolvePackagePath(n))
        .map(location => this.#create(location, { parent: node }));

      queue.push(...next);
    }

    return await this.#complete(seen);
  }
}