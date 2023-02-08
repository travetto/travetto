import ts from 'typescript';

import { RootIndex } from '@travetto/manifest';

import { NodeTransformer } from './types/visitor';
import { VisitorFactory } from './visitor';
import { TransformerState } from './state';
import { getAllTransformers } from './register';

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
  static async create(transformerFiles: string[]): Promise<TransformerManager> {
    const transformers: NodeTransformer<TransformerState>[] = [];

    for (const file of transformerFiles) { // Exclude based on blacklist
      const entry = RootIndex.getEntry(file)!;
      transformers.push(...getAllTransformers(await import(entry.import), entry.module));
    }

    // Prepare a new visitor factory with a given type checker
    return new TransformerManager(transformers);
  }

  #cached: ts.CustomTransformers | undefined;
  #transformers: NodeTransformer<TransformerState>[];

  constructor(transformers: NodeTransformer<TransformerState>[]) {
    this.#transformers = transformers;
  }

  /**
   * Initialize with type checker
   * @param checker
   */
  init(checker: ts.TypeChecker): void {
    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, checker),
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