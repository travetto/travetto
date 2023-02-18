import ts from 'typescript';

import { ManifestIndex, path, RootIndex } from '@travetto/manifest';

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
  static async create(manifestIndex: ManifestIndex): Promise<TransformerManager> {
    const transformerFiles = Object.values(manifestIndex.manifest.modules).flatMap(
      x => (x.files.$transformer ?? []).map(([f]) =>
        path.resolve(manifestIndex.manifest.workspacePath, x.sourceFolder, f)
      )
    );

    const transformers: NodeTransformer<TransformerState>[] = [];

    for (const file of transformerFiles) { // Exclude based on blacklist
      const entry = RootIndex.getEntry(file)!;
      transformers.push(...getAllTransformers(await import(entry.import), entry.module));
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
      (ctx, src) => new TransformerState(src, ctx.factory, checker, this.#manifestIndex),
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