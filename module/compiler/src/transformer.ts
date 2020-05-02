import * as ts from 'typescript';
import { ScanApp, Env } from '@travetto/base';

import {
  NodeTransformer, VisitorFactory, TransformerState, getTransformHandlers
} from './transform-support'; // Narrow import to minimize scope

// Local app support transformer, as well as library support transformer
const TRANSFORMER_RE = /support\/transformer[.](.*?)[.]ts$/;

/**
 * Manages the typescript transformers
 */
export class TransformerManager {

  private cached: { before: ts.TransformerFactory<ts.SourceFile>[] };
  transformers: (NodeTransformer<TransformerState> & { file: string })[] = [];

  constructor(private cwd: string) { }

  /**
   * Read all transformers from disk under the pattern support/transformer.*
   */
  init() {
    const found = ScanApp.findSourceFiles(x => TRANSFORMER_RE.test(x), this.cwd)
      .filter(x =>
        !x.module.includes('@travetto') || !ScanApp.modAppExclude.includes(x.module.split(/@travetto\//)[1].split('/')[0]));

    for (const name of found) { // Exclude based on blacklist
      const all = require(name.file);
      const resolved = Object
        .values(all)
        .map(x => getTransformHandlers(x) as this['transformers'])
        .filter(x => !!x && x.length > 0);

      for (const transformers of resolved) {
        this.transformers.push(...transformers.map(x => {
          x.file = name.module;
          return x;
        }));
      }
    }

    if (!Env.quietInit) { // Log loaded transformers
      console.debug('Transformers',
        ...this.transformers.map(x => {
          const name = x.file.match(TRANSFORMER_RE)![1];
          const flags = [
            ...(x.target ? [] : ['all']),
            ...(x.before ? ['before'] : []),
            ...(x.after ? ['after'] : [])
          ];
          return `\n\t[${x.type}] ${name} - ${flags.join(' ')}`;
        })
      );
    }

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