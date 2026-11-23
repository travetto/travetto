import fs from 'node:fs/promises';

import { type IndexedFile, type ManifestIndex, path } from '@travetto/manifest';
import { RuntimeIndex } from '@travetto/runtime';

const IMPORT_EXPORT_REGEX = /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Lightweight text-based import graph for resolving potentially impacted tests on file changes
 */
export class TestImpactGraph {
  #index: ManifestIndex;
  #dependencies = new Map<string, Set<string>>();
  #importers = new Map<string, Set<string>>();

  constructor(index: ManifestIndex = RuntimeIndex) {
    this.#index = index;
  }

  /**
   * Extract module specifiers from source text without invoking the TypeScript compiler
   */
  static extractSpecifiers(content: string): string[] {
    const specifiers = new Set<string>();
    for (const match of content.matchAll(IMPORT_EXPORT_REGEX)) {
      const specifier = match[1] ?? match[2];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
    return [...specifiers];
  }

  #resolveSpecifier(specifier: string, fromSourceFile: string): IndexedFile | undefined {
    let entry: IndexedFile | undefined;
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fromSourceFile), specifier);
      entry =
        this.#index.getEntry(resolved) ??
        this.#index.getEntry(`${resolved}.ts`) ??
        this.#index.getEntry(`${resolved}/__index__.ts`);
    } else {
      entry = this.#index.getFromImport(specifier) ?? this.#index.getFromImport(`${specifier}/__index__`);
    }

    if (!entry || entry.sourceFile === fromSourceFile) {
      return undefined;
    }

    const module = this.#index.getModule(entry.module);
    return module?.workspace ? entry : undefined;
  }

  /**
   * Build the initial import graph for all workspace TypeScript/JavaScript files
   */
  async init(): Promise<void> {
    const files = this.#index.find({
      module: module => !!module.workspace,
      file: file => file.type === 'ts' || file.type === 'js'
    });
    await Promise.all(files.map(file => this.updateFile(file.sourceFile)));
  }

  /**
   * Remove a source file and its outgoing dependency edges from the graph
   */
  removeFile(sourceFile: string): void {
    const previous = this.#dependencies.get(sourceFile);
    if (previous) {
      for (const dependency of previous) {
        this.#importers.get(dependency)?.delete(sourceFile);
      }
      this.#dependencies.delete(sourceFile);
    }
  }

  /**
   * Re-read a source file's text and refresh its dependency edges
   */
  async updateFile(sourceFile: string): Promise<void> {
    this.removeFile(sourceFile);

    let content: string;
    try {
      content = await fs.readFile(sourceFile, 'utf8');
    } catch {
      return;
    }

    const next = new Set<string>();
    for (const specifier of TestImpactGraph.extractSpecifiers(content)) {
      const resolved = this.#resolveSpecifier(specifier, sourceFile);
      if (resolved) {
        next.add(resolved.sourceFile);
        this.#importers.getOrInsert(resolved.sourceFile, new Set()).add(sourceFile);
      }
    }
    this.#dependencies.set(sourceFile, next);
  }

  /**
   * Find all test files that could be impacted by a change to sourceFile within maxDepth hops
   */
  getImpactedTests(sourceFile: string, maxDepth = 3): IndexedFile[] {
    const visited = new Set<string>([sourceFile]);
    const queue: [file: string, depth: number][] = [[sourceFile, 0]];
    const impacted: IndexedFile[] = [];

    while (queue.length > 0) {
      const [current, depth] = queue.shift()!;
      const entry = this.#index.getEntry(current);
      if (entry && entry.role === 'test' && (entry.type === 'ts' || entry.type === 'js')) {
        impacted.push(entry);
      }

      if (depth >= maxDepth) {
        continue;
      }

      for (const importer of this.#importers.get(current) ?? []) {
        if (!visited.has(importer)) {
          visited.add(importer);
          queue.push([importer, depth + 1]);
        }
      }
    }

    return impacted;
  }
}
