import { TranspileUtil } from '@travetto/boot';
import { Env } from '@travetto/base';
import { CompilerAdaptor } from './compiler';
import { DiAdaptor } from './di';

export class WatchUtil {
  static init() {
    TranspileUtil.addPreProcessor((name, contents) =>
      contents.replace(/\/[*]\s*WATCH\s*[*]\/\s*(.*)\s*\/[*]\s*WATCH\s*[*]\//g, (line, tgt) =>
        `(require('@travetto/watch').WatchUtil.register(${tgt}))`));
  }

  static register(tgt: any) {
    if (Env.watch) {
      switch (tgt.name) {
        case '$Compiler': return CompilerAdaptor(tgt);
        case '$DependencyRegistry': return DiAdaptor(tgt);
      }
    }
    return tgt;
  }
}