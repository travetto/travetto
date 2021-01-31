import * as ts from 'typescript';
import * as fs from 'fs';

import { FsUtil, ScanFs } from '@travetto/boot';

import { VisitorFactory, TransformerState, getAllTransformers } from '..';

/**
 * Utils for testing transformerse
 */
export class TranformerTestUtil {
  /**
   * Compile a single file from a folder
   */
  static async compile(folder: string, file?: string) {
    let tsconfig = FsUtil.resolveUnix(folder, 'tsconfig.json');

    if (!FsUtil.existsSync(tsconfig)) {
      tsconfig = FsUtil.resolveUnix(__dirname, '..', '..', 'node_modules', '@travetto', 'boot', 'tsconfig.json');
    }

    const prog = ts.createProgram({
      options: ts.convertCompilerOptionsFromJson(require(tsconfig), tsconfig).options,
      rootNames: (await ScanFs.scanDir({ testFile: f => f.startsWith('src/') && f.endsWith('.ts') }, folder))
        .filter(x => x.stats.isFile())
        .filter(x => !file || x.file.endsWith(file))
        .map(x => x.file),
    });
    const log = `${folder}/.trv_compiler.log`;

    await FsUtil.unlinkRecursive(log, true);

    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, prog.getTypeChecker()),
      (await ScanFs.scanDir({ testFile: f => f.startsWith('support/transformer') }, folder))
        .filter(x => x.stats.isFile())
        .map(x => getAllTransformers(require(x.file)))
        .flat(),
      log
    );

    const out = await new Promise<string>(res => {
      prog.emit(prog.getSourceFile(`src/${file}`), (__, data) => res(data), undefined, false,
        { before: [visitor.visitor()] }
      );
    });

    await new Promise((res) => setTimeout(res, 1000)); // Wait for file buffer to sync
    console.info(fs.readFileSync(log, 'utf8'));

    await FsUtil.unlinkRecursive(log, true);

    return out;
  }
}