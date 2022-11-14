import * as ts from 'typescript';

import { ManifestModule } from '@travetto/common';

import { NodeTransformer } from './types/visitor';
import { VisitorFactory } from './visitor';
import { TransformerState } from './state';
import { getAllTransformers } from './register';
import { ManifestManager } from './manifest';

type TransformerList = { before: ts.TransformerFactory<ts.SourceFile>[] };

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  #cached: TransformerList | undefined;
  #transformers: NodeTransformer<TransformerState>[] = [];
  #manifest: ManifestManager;

  /**
   * Read all transformers from disk under the pattern support/transformer.*
   */
  async init(transformers: string[], modules: ManifestModule[]): Promise<void> {
    if (this.#cached) {
      return;
    }

    this.#manifest = new ManifestManager(modules);

    for (const entry of transformers) { // Exclude based on blacklist
      this.#transformers.push(...getAllTransformers(await import(entry)));
    }

    console.debug('Transformers', {
      order: this.#transformers.map(x => {
        const flags = [
          ...(x.target ? [] : ['all']),
          ...(x.before ? ['before'] : []),
          ...(x.after ? ['after'] : [])
        ];
        return { type: x.type, key: x.key, flags: flags.join(' ') };
      })
    });

    // Prepare a new visitor factory with a given type checker
  }

  build(checker: ts.TypeChecker): void {
    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, checker, this.#manifest),
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
  getTransformers(): TransformerList | undefined {
    return this.#cached!;
  }
}