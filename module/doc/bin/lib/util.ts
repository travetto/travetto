import * as path from 'path';
import { FsUtil, ExecUtil, EnvUtil } from '@travetto/boot';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';
import type { Renderer, AllChildren } from '../../src/render';

const PRIMARY_BRANCH = EnvUtil.get('TRV_DOC_BRANCH') ||
  ExecUtil.execSync('git', ['status', '-b', '-s', '.']).split(/\n/)[0].split('...')[0].split(' ')[1].trim();
const REPO = (require(`${FsUtil.cwd}/package.json`).repository?.url || '').split(/[.]git$/)[0];
const GIT_SRC_ROOT = `${REPO}/tree/${PRIMARY_BRANCH}`;

export class CliDocUtil {
  /**
   * Initialize for doc gen
   */
  static async init() {
    await CompileCliUtil.compile(undefined, {
      TRV_SRC_LOCAL: 'doc'
    });

    process.env.TRV_SRC_LOCAL = '';
    process.env.TRV_RESOURCES = 'doc/resources';
    process.env.TRV_DEBUG = '0';
    process.env.TRV_LOG_PLAIN = '1';

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
  }

  /**
   * Retrieve the doc renderer
   * @param fmt
   */
  static async getRenderer(fmt: string) {
    fmt = fmt.replace(/^[.]/, ''); // Strip leading .
    const { Renderers } = await import('../..');
    const renderer = Renderers[fmt as keyof typeof Renderers];
    if (!renderer) {
      console.error('Format unknown', { fmt });
      process.exit(1);
    }
    return renderer;
  }

  /**
   * Generate the text
   * @param renderer
   */
  static async generate(file: string, renderer: Renderer) {
    const { Header } = await import('../..');
    file = FsUtil.resolveUnix(file);

    const doc: { header?: boolean, toc?: string, text: AllChildren } = await import(file);
    let content = '';
    if (doc.header !== false) {
      content = `${renderer.render(Header(FsUtil.cwd)).trim()}\n`;
    }
    content = `${content}${renderer.render(doc.text)}`.replace(/\n{3,100}/msg, '\n\n');
    content = renderer.wrap(content, this.getPackageName());
    if (doc.toc && 'nodes' in doc.text) {
      content = renderer.toc(content, doc.toc,
        doc.text.nodes
          .filter(x => x._type === 'section')
          .map((x: any) => ({ _type: 'anchor', title: x.title, fragment: x.title }))
      );
    }
    content = `<!-- This file was generated by the framweork and should not be modified directly -->
<!-- Please modify ${file.replace(/.*travetto\//, '%GIT%/')} and execute "npm run docs" to rebuild -->
${content}`;
    return content.replace(/%GIT%/g, GIT_SRC_ROOT);
  }

  static getPackageName() {
    return path.basename(FsUtil.cwd);
  }

  /**
   * Get the output location
   * @param output
   */
  static async getOutputLoc(output: string) {
    const root = FsUtil.resolveUnix(output);
    const name = this.getPackageName();
    return root.replace(/%MOD/g, name);
  }

  /**
   * Watch a file
   * @param file
   * @param cb
   */
  static async watchFile(file: string, cb: (ev: any) => void) {
    const { Watcher } = await import('@travetto/watch');
    const { Compiler } = await import('@travetto/compiler');

    new Watcher(__dirname, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', e => {
        Compiler.unload(require.resolve(FsUtil.resolveUnix(file)));
        cb(e);
      });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }
}