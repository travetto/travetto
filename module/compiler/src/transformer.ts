import * as ts from 'typescript';
import { ScanApp } from '@travetto/base';

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
  init() {
    if (this.cached) {
      return;
    }

    // Modules
    const found = ScanApp.findFiles({ folder: 'support', filter: /\/transformer.*[.]ts/ })
      .filter(x => !x.module.startsWith('alt')); // Exclude alt if they ever show up

    for (const entry of found) { // Exclude based on blacklist
      this.transformers.push(...getAllTransformers(require(entry.file)));
    }

    console.debug('Transformers',
      ...this.transformers.map(x => {
        const flags = [
          ...(x.target ? [] : ['all']),
          ...(x.before ? ['before'] : []),
          ...(x.after ? ['after'] : [])
        ];
        return `\n\t[${x.type}] ${x.key} - ${flags.join(' ')}`;
      })
    );

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