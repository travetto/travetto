import * as ts from 'typescript';

import { ScanApp } from '@travetto/base';
import { VisitorFactory, NodeTransformer } from '@travetto/compiler/src/transformer/visitor'; // Narrow import to minimize scope
import { TransformerState } from './state';

export class TransformerManager {

  transformers: ts.CustomTransformers = {};
  visitor: VisitorFactory;
  checker: ts.TypeChecker;

  constructor(private cwd: string) { }

  init() {
    const allTransformers: NodeTransformer<any, any>[] = [];

    for (const name of ScanApp.findFiles('.ts', x => /support\/transformer[.].*?[.]ts$/.test(x))) {
      const { transformers } = require(name.file);
      allTransformers.push(...(transformers ?? []).map((x: any) => { x.file = name.file; return x; }));
    }

    console.debug('Transformers',
      ...allTransformers.map(x => {
        const name = (x as any).file.split('node_modules/').pop()!.replace('/support/transformer.', ':').replace('.ts', '');
        const flags = [
          ...(x.all ? ['all'] : []),
          ...(x.before ? ['before'] : []),
          ...(x.after ? ['after'] : [])
        ];
        return `\n\t[${x.type}] ${name} - ${flags.join(' ')}`;
      })
    );

    this.visitor = new VisitorFactory(
      src => new TransformerState(src, this.checker),
      allTransformers
    );
    this.transformers = {
      before: [this.visitor.visitor()]
    };
  }
}