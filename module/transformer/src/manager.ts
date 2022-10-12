import * as ts from 'typescript';

import { ModuleIndex } from '@travetto/boot/src/internal/module';

import { NodeTransformer } from './types/visitor';
import { VisitorFactory } from './visitor';
import { TransformerState } from './state';
import { getAllTransformers } from './register';
import { SystemUtil } from './util/system';

type TransformerList = { before: ts.TransformerFactory<ts.SourceFile>[] };

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  #cached: TransformerList | undefined;
  #transformers: NodeTransformer<TransformerState>[] = [];

  /**
   * Read all transformers from disk under the pattern support/transformer.*
   */
  async init(): Promise<void> {
    if (this.#cached) {
      return;
    }

    // Modules
    const found = ModuleIndex.find({ folder: SystemUtil.PATH.support, filter: /\/transformer.*[.]ts/ });

    for (const entry of found) { // Exclude based on blacklist
      this.#transformers.push(...getAllTransformers(await import(entry.file)));
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
  getTransformers(): TransformerList | undefined {
    return this.#cached!;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.#transformers = [];
    this.#cached = undefined;
  }
}