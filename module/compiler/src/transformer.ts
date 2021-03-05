import * as ts from 'typescript';
import { SourceCodeIndex } from '@travetto/boot/src/internal';

import {
  NodeTransformer, VisitorFactory, TransformerState, getAllTransformers
} from '@travetto/transformer'; // Narrow import to minimize scope

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  private cached: { before: ts.TransformerFactory<ts.SourceFile>[] } | undefined;
  transformers: NodeTransformer<TransformerState>[] = [];

  constructor() { }

  /**
   * Read all transformers from disk under the pattern support/transformer.*
   */
  async init() {
    if (this.cached) {
      return;
    }

    // Modules
    const found = SourceCodeIndex.find({ folder: 'support', filter: /\/transformer.*[.]ts/ });

    for (const entry of found) { // Exclude based on blacklist
      this.transformers.push(...getAllTransformers(await import(entry.file)));
    }

    console.debug('Transformers', {
      order: this.transformers.map(x => {
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

  build(checker: ts.TypeChecker) {
    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, checker),
      this.transformers
    );

    // Define transformers for the compiler
    this.cached = {
      before: [visitor.visitor()]
    };
  }

  /**
   * Get typescript transformer object
   */
  getTransformers() {
    return this.cached!;
  }

  /**
   * Reset state
   */
  reset() {
    this.transformers = [];
    delete this.cached;
  }
}