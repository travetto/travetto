import * as ts from 'typescript';
import { FsUtil, ScanFs } from '@travetto/boot';

import { VisitorFactory, TransformerState, getAllTransformers } from '../..';

/**
 * Utils for testing transformerse
 */
export class TranformerTestUtil {
  /**
   * Compile a single file from a folder
   */
  static compile(folder: string, file: string) {
    const tsconfig = FsUtil.resolveUnix(folder, 'tsconfig.json');

    const prog = ts.createProgram({
      options: ts.convertCompilerOptionsFromJson(require(tsconfig), tsconfig).options,
      rootNames: ScanFs.scanDirSync({ testFile: f => f.startsWith('src/') && f.endsWith('.ts') }, folder)
        .filter(x => x.stats.isFile())
        .map(x => x.file),
    });

    const visitor = new VisitorFactory(
      src => new TransformerState(src, prog.getTypeChecker()),
      ScanFs.scanDirSync({ testFile: f => f.startsWith('support/transformer') }, folder)
        .filter(x => x.stats.isFile())
        .map(x => getAllTransformers(require(x.file)))
        .flat()
    );

    return new Promise<string>(res => {
      prog.emit(prog.getSourceFile(`src/${file}`), (__, data) => res(data), undefined, false,
        { before: [visitor.visitor()] }
      );
    });
  }
}