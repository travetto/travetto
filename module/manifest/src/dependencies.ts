import { PackageUtil } from './package';
import { path } from './path';

import type { PackageVisitor, PackageNode } from './types/package';
import type { ManifestContext } from './types/context';
import type { ManifestPackageNode } from './types/manifest';

/**
 * Used for walking dependencies for collecting modules for the manifest
 */
export class ManifestPackageVisitor implements PackageVisitor<ManifestPackageNode> {

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
  async init(node: PackageNode<ManifestPackageNode>): Promise<PackageNode<ManifestPackageNode>[]> {
    const pkg = PackageUtil.readPackage(node.sourcePath);
    const workspacePkg = PackageUtil.readPackage(this.ctx.workspace.path);

    this.#mainLikeModules = new Set([
      pkg.name,
      ...Object.entries(pkg.travetto?.build?.withModules ?? []).filter(x => x[1] === 'main').map(x => x[0]),
    ]);

    const globals = Object.keys(workspacePkg.travetto?.build?.withModules ?? [])
      .map(name => PackageUtil.packageReq<ManifestPackageNode>(
        PackageUtil.resolvePackagePath(name),
        { prod: name in (workspacePkg.dependencies ?? {}), topLevel: true, }
      ));

    // Capture workspace modules as dependencies
    if (this.ctx.workspace.mono && !this.ctx.main.folder) { // We are at the root of the workspace
      for (const mod of await PackageUtil.resolveWorkspaces(this.ctx)) {
        // Add workspace folders, for tests and docs
        this.#mainLikeModules.add(mod.name);
        globals.push(PackageUtil.packageReq<ManifestPackageNode>(
          path.resolve(this.ctx.workspace.path, mod.sourcePath),
          { topLevel: true, workspace: true }
        ));
      }
    }

    return globals;
  }

  /**
   * Is valid dependency for searching
   */
  valid(node: PackageNode<ManifestPackageNode>): boolean {
    return node.workspace || !!node.pkg.travetto; // Workspace or travetto module
  }

  /**
   * Create manifest package from node
   */
  create(node: PackageNode<ManifestPackageNode>): ManifestPackageNode {
    const { prod, pkg, sourcePath } = node;
    const { name, version } = pkg;
    const main = name === this.ctx.main.name;
    const mainLike = main || this.#mainLikeModules.has(name);
    const internal = pkg.private === true;
    const workspace = node.workspace || mainLike;
    const topLevel = node.topLevel || mainLike;

    const out: ManifestPackageNode = {
      name, version, sourcePath, main, mainLike, workspace, internal, pkg, prod, topLevel,
      parent: new Set([]), children: new Set([]), roles: new Set(pkg.travetto?.roles),
    };

    return out;
  }

  /**
   * Visit dependency
   */
  visit(node: PackageNode<ManifestPackageNode>, dep: ManifestPackageNode): void {
    const { parent } = node;
    if (parent && dep.name !== this.ctx.main.name) {
      dep.parent!.add(parent.name);
      parent.children.add(dep.name);
    }
  }

  /**
   * Propagate prod, role information through graph
   */
  complete(deps: Set<ManifestPackageNode>): Set<ManifestPackageNode> {
    const mapping = new Map<string, { parent: Set<string>, child: Set<string>, el: ManifestPackageNode }>();
    for (const el of deps) {
      mapping.set(el.name, { parent: new Set(el.parent), child: new Set(el.children), el });
    }

    const main = mapping.get(this.ctx.main.name)!;

    // Visit all direct dependencies and mark
    for (const { el } of mapping.values()) {
      if (el === main.el) { continue; }
      if (el.topLevel || main.child.has(el.name)) {
        if (!el.roles.size) {
          el.roles.add('std');
        }
        main.child.add(el.name); // Ensure top level is a child of main for propagation
        mapping.get(el.name)!.parent.add(main.el.name);
      } else if (!main.child.has(el.name)) { // Not a direct descendent or top-level
        el.prod = false;
        el.roles.clear(); // Only allow roles via propagation
      }
    }

    // Color parent
    main.el.roles.add('std');
    main.el.prod = true;

    while (mapping.size > 0) {
      const toProcess = [...mapping.values()].filter(x => x.parent.size === 0);
      if (!toProcess.length) {
        throw new Error(`We have reached a cycle for ${[...mapping.keys()]}`);
      }
      // Propagate to children
      for (const { el, child } of toProcess) {
        for (const c of child.keys()) {
          const { el: cDep, parent } = mapping.get(c)!;
          parent.delete(el.name); // Remove from child
          if (cDep.name in (el.pkg.dependencies ?? {})) { // If an owned prod-dependency
            for (const role of el.roles) {
              cDep.roles.add(role); // Transfer roles
            }
            cDep.prod ||= el.prod; // Allow prod to trickle down as needed
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