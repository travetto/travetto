import ts from 'typescript';

import { ManifestRoot } from '@travetto/manifest';

import { NodeTransformer } from './types/visitor';
import { VisitorFactory } from './visitor';
import { TransformerState } from './state';
import { getAllTransformers } from './register';
import { TransformerIndex } from './manifest-index';

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
    const idx = new TransformerIndex('.', manifest);

    for (const file of transformerFiles) { // Exclude based on blacklist
      const entry = idx.getEntry(file)!;
      transformers.push(...getAllTransformers(await import(file), entry.module));
    }

    // Prepare a new visitor factory with a given type checker
    return new TransformerManager(transformers, idx);
  }

  #cached: ts.CustomTransformers | undefined;
  #transformers: NodeTransformer<TransformerState>[];
  #index: TransformerIndex;

  constructor(transformers: NodeTransformer<TransformerState>[], index: TransformerIndex) {
    this.#transformers = transformers;
    this.#index = index;

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
      (ctx, src) => new TransformerState(src, ctx.factory, checker, this.#index, ctx.getCompilerOptions()),
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