import * as ts from 'typescript';

import { ScanApp } from '@travetto/base';
import { VisitorFactory, NodeTransformer } from '@travetto/compiler/src/transformer/visitor';

export class TransformerManager {

  transformers: ts.CustomTransformers = {};
  visitor: VisitorFactory;

  constructor(private cwd: string) { }

  init() {
    const allTransformers: NodeTransformer<any, any>[] = [];

    for (const name of ScanApp.findFiles('.ts', x => /support\/transformer[.].*?[.]ts$/.test(x))) {
      const { transformers } = require(name.file);
      allTransformers.push(...(transformers || []));
      for (const transformer of (transformers || [])) {
        console.debug('Configured Transformers', name.module, transformer);
      }
    }

    this.visitor = new VisitorFactory(allTransformers);
    this.transformers = {
      before: [this.visitor.generate()]
    };
  }
}