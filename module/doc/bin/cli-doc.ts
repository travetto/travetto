import * as commander from 'commander';

import { CompileCliUtil } from '@travetto/compiler/bin/lib/index';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FsUtil } from '@travetto/boot';

/**
 * Command line support for generating module docs.
 */
export class DocPlugin extends BasePlugin {

  name = 'doc';

  init(cmd: commander.Command) {
    return cmd
      .option('-o, --output <output>', 'Output directory')
      .option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    await CompileCliUtil.compile();
    process.env.TRV_DEBUG = '0';
    process.env.TRV_LOG_PLAIN = '1';
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
    const { default: all } = await import(FsUtil.resolveUnix(FsUtil.cwd, './README.ts'));
    const { Markdown, Header } = await import('..');
    console.log(Markdown.render(Header(FsUtil.cwd)));
    console.log(Markdown.render(all));
  }

  complete() {
    return {
      '': ['--quiet', '--output']
    };
  }
}