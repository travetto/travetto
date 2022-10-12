import * as ts from 'typescript';
import * as timer from 'timers/promises';
import { readFileSync } from 'fs';

import { FsUtil, Host, ScanFs } from '@travetto/boot';

import { VisitorFactory, TransformerState, getAllTransformers } from '..';

/**
 * Utils for testing transformers
 */
export class TransformerTestUtil {
  /**
   * Compile a single file from a folder
   */
  static async compile(folder: string, file?: string): Promise<string> {

    const tsconfigObj = await import('@travetto/boot/tsconfig.trv.json');

    const prog = ts.createProgram({
      options: ts.convertCompilerOptionsFromJson(tsconfigObj, '').options,
      rootNames: (await ScanFs.scanDir({ testFile: f => f.startsWith(Host.PATH.srcWithSep) && f.endsWith(Host.EXT.input) }, folder))
        .filter(x => x.stats?.isFile())
        .filter(x => !file || x.file.endsWith(file))
        .map(x => x.file),
    });
    const log = `${folder}/.trv_compiler.log`;

    await FsUtil.unlinkRecursive(log);

    const transformers =
      (await ScanFs.scanDir({ testFile: f => f.startsWith('support/transformer') }, folder))
        .filter(x => x.stats?.isFile())
        .map(x => import(x.file).then(getAllTransformers));

    const visitor = new VisitorFactory(
      (ctx, src) => new TransformerState(src, ctx.factory, prog.getTypeChecker()),
      (await Promise.all(transformers)).flat(),
      log
    );

    const out = await new Promise<string>(res => {
      prog.emit(prog.getSourceFile(`src/${file}`), (__, data) => res(data), undefined, false,
        { before: [visitor.visitor()] }
      );
    });

    await timer.setTimeout(1000); // Wait for file buffer to sync
    try {
      console.info(readFileSync(log, 'utf8'));
    } catch { }

    await FsUtil.unlinkRecursive(log);

    return out;
  }
}