import { TranspileUtil, EnvUtil } from '@travetto/boot';

import { CompilerAdaptor } from './extension/compiler';
import { DiAdaptor } from './extension/di';
import { ModelAdaptor } from './extension/model';

export class WatchUtil {
  static init() {
    if (EnvUtil.isTrue('WATCH')) {
      console.debug('Running in watch mode');
    }
    TranspileUtil.addInlineFunction('watch',
      text => `(require('@travetto/watch').WatchUtil.register(${text}))`);
  }

  static register(tgt: any) {
    if (EnvUtil.isTrue('WATCH')) {
      switch (tgt.name || tgt.constructor.name) {
        case '$Compiler': return CompilerAdaptor(tgt);
        case '$DependencyRegistry': return DiAdaptor(tgt);
        case 'ModelService': return ModelAdaptor(tgt);
      }
    }
    return tgt;
  }
}