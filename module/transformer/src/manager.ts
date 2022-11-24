import ts from 'typescript';

import type { ManifestModule } from '@travetto/manifest';

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
   * @param modules
   * @returns
   */
  static async create(transformerFiles: string[], modules: ManifestModule[]): Promise<TransformerManager> {
    const transformers: NodeTransformer<TransformerState>[] = [];

    for (const entry of transformerFiles) { // Exclude based on blacklist
      transformers.push(...getAllTransformers(await import(entry)));
    }

    // Prepare a new visitor factory with a given type checker
    return new TransformerManager(transformers, modules);
  }

  #cached: ts.CustomTransformers | undefined;
  #transformers: NodeTransformer<TransformerState>[];
  #manifest: ManifestManager;

  constructor(transformers: NodeTransformer<TransformerState>[], modules: ManifestModule[]) {
    this.#transformers = transformers;
    this.#manifest = new ManifestManager(modules);

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