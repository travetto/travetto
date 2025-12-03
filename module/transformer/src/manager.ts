import ts from 'typescript';

import { ManifestIndex, ManifestModuleUtil } from '@travetto/manifest';

import { NodeTransformer } from './types/visitor.ts';
import { VisitorFactory } from './visitor.ts';
import { TransformerState } from './state.ts';
import { getAllTransformers } from './register.ts';

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
  static async create(manifestIndex: ManifestIndex): Promise<TransformerManager> {
    const transformerFiles = manifestIndex.find({ folder: folder => folder === '$transformer' }).map(file => file.sourceFile);

    const transformers: NodeTransformer<TransformerState>[] = [];

    for (const file of transformerFiles) { // Exclude based on blacklist
      const entry = manifestIndex.getEntry(file)!;
      transformers.push(...getAllTransformers(await import(ManifestModuleUtil.withOutputExtension(entry.import)), entry.module));
    }

    for (const transformer of transformers) {
      process.send?.({
        type: 'log', payload: {
          level: 'debug',
          message: `Loaded Transformer: ${transformer.key}#${transformer.type}`, scope: 'transformers'
        }
      });
    }

    // Prepare a new visitor factory with a given type checker
    return new TransformerManager(manifestIndex, transformers);
  }

  #cached: ts.CustomTransformers | undefined;
  #transformers: NodeTransformer<TransformerState>[];
  #manifestIndex: ManifestIndex;

  constructor(manifestIndex: ManifestIndex, transformers: NodeTransformer<TransformerState>[]) {
    this.#transformers = transformers;
    this.#manifestIndex = manifestIndex;
  }

  /**
   * Initialize with type checker
   * @param checker
   */
  init(checker: ts.TypeChecker): void {
    const visitor = new VisitorFactory(
      (ctx, source) => new TransformerState(source, ctx.factory, checker, this.#manifestIndex),
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