import { TranspileUtil } from '@travetto/boot';
import { Env } from '@travetto/base';
import { CompilerAdaptor } from './extension/compiler';
import { DiAdaptor } from './extension/di';
import { ModelAdaptor } from './extension/model';

export class WatchUtil {
  static init() {
    TranspileUtil.addPreProcessor((name, contents) =>
      contents.replace(/\/[*]\s*WATCH\s*[*]\/\s*(.*)\s*\/[*]\s*WATCH\s*[*]\//g, (line, tgt) =>
        `(require('@travetto/watch').WatchUtil.register(${tgt}))`));
  }

  static register(tgt: any) {
    if (Env.watch) {
      switch (tgt.name || tgt.constructor.name) {
        case '$Compiler': return CompilerAdaptor(tgt);
        case '$DependencyRegistry': return DiAdaptor(tgt);
        case 'ModelService': return ModelAdaptor(tgt);
      }
    }
    return tgt;
  }
}