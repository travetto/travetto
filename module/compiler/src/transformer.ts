import * as ts from 'typescript';
import { ScanApp } from '@travetto/base';

import {
  NodeTransformer, VisitorFactory, TransformerState, getAllTransformers
} from '@travetto/transformer'; // Narrow import to minimize scope

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  private cached: { before: ts.TransformerFactory<ts.SourceFile>[] };
  transformers: (NodeTransformer<TransformerState> & { file: string })[] = [];

  constructor() { }

  /**
   * Read all transformers from disk under the pattern support/transformer.*
   */
  init() {
    if (this.cached) {
      return;
    }

    // Modules
    const found = ScanApp.findFiles({ folder: 'support', filter: /\/transformer.*[.]ts/ });

    for (const entry of found) { // Exclude based on blacklist
      for (const transformer of getAllTransformers(require(entry.file))) {
        const withFile = transformer as this['transformers'][number];
        withFile.file = entry.file;
        this.transformers.push(withFile);
      }
    }

    console.debug('Transformers',
      ...this.transformers.map(x => {
        const name = x.file.split(/[.]/).slice(1, -1).join('.');
        const flags = [
          ...(x.target ? [] : ['all']),
          ...(x.before ? ['before'] : []),
          ...(x.after ? ['after'] : [])
        ];
        return `\n\t[${x.type}] ${name} - ${flags.join(' ')}`;
      })
    );

    // Prepare a new visitor factory with a given type checker
  }

  build(checker: ts.TypeChecker) {
    const visitor = new VisitorFactory(
      src => new TransformerState(src, checker),
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
    return this.cached;
  }

  /**
   * Reset state
   */
  reset() {
    this.transformers = [];
    delete this.cached;
  }
}