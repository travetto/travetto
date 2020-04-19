import * as ts from 'typescript';
import { ScanApp, Env } from '@travetto/base';

import {
  NodeTransformer, VisitorFactory, TransformerState, getTransformHandlers
} from './transform-support'; // Narrow import to minimize scope

// Local app support transformer, as well as library support transformer
const TRANSFORMER_RE = /^(node_modules\/@travetto\/[^/]*\/)?support\/transformer[.](.*?)[.]ts$/;

export class TransformerManager {

  transformers: ts.CustomTransformers = {};
  visitor: VisitorFactory<TransformerState>;
  checker: ts.TypeChecker;

  constructor(private cwd: string) { }

  init() {
    const allTransformers: (NodeTransformer<TransformerState> & { file: string })[] = [];

    for (const name of ScanApp.findSourceFiles(x => TRANSFORMER_RE.test(x), this.cwd)) {
      const all = require(name.file);
      const resolved = Object
        .values(all)
        .map(x => getTransformHandlers(x) as typeof allTransformers)
        .filter(x => !!x && x.length > 0);

      for (const transformers of resolved) {
        allTransformers.push(...transformers.map(x => {
          x.file = name.module;
          return x;
        }));
      }
    }

    if (!Env.quietInit) {
      console.debug('Transformers',
        ...allTransformers.map(x => {
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

    this.visitor = new VisitorFactory(
      src => new TransformerState(src, this.checker),
      allTransformers
    );

    this.transformers = {
      before: [this.visitor.visitor()]
    };
  }
}