import ts from 'typescript';

import type { ManifestRoot } from '@travetto/manifest';

import { NodeTransformer } from './types/visitor';
import { VisitorFactory } from './visitor';
import { TransformerState } from './state';
import { getAllTransformers } from './register';
import { ManifestManager } from './manifest';

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  /**
   * Create transformer manager
   * @param transformerFiles
   * @param manifest
   * @returns
   */
  static async create(transformerFiles: string[], manifest: ManifestRoot): Promise<TransformerManager> {
    const transformers: NodeTransformer<TransformerState>[] = [];
    const mgr = new ManifestManager(manifest);

    for (const file of transformerFiles) { // Exclude based on blacklist
      const src = mgr.toSource(file);
      const entry = mgr.getEntry(src);
      transformers.push(...getAllTransformers(await import(file), entry.module));
    }

    // Prepare a new visitor factory with a given type checker
    return new TransformerManager(transformers, mgr);
  }

  #cached: ts.CustomTransformers | undefined;
  #transformers: NodeTransformer<TransformerState>[];
  #manifest: ManifestManager;

  constructor(transformers: NodeTransformer<TransformerState>[], manifestManager: ManifestManager) {
    this.#transformers = transformers;
    this.#manifest = manifestManager;

    console.debug('Transformers', {
      order: transformers.map(x => {
        const flags = [
          ...(x.target ? [] : ['all']),
          ...(x.before ? ['before'] : []),
          ...(x.after ? ['after'] : [])
        ];
        return { type: x.type, key: x.key, flags: flags.join(' ') };
      })
    });
  }

  /**
   * Initialize with type checker
   * @param checker
   */
  init(checker: ts.TypeChecker): void {
    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, checker, this.#manifest, ctx.getCompilerOptions()),
      this.#transformers
    );

    // Define transformers for the compiler
    this.#cached = {
      before: [visitor.visitor()]
    };
  }

  /**
   * Get typescript transformer object
   */
  get(): ts.CustomTransformers | undefined {
    return this.#cached!;
  }
}