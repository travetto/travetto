import * as path from 'path';
import { Package, FsUtil, ExecUtil, EnvUtil } from '@travetto/boot';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';

import { AllType } from '../../src/node-types';
import type { DocumentContext, Renderer } from '../../src/render/types';


const PRIMARY_BRANCH = EnvUtil.get('TRV_DOC_BRANCH') ||
  ExecUtil.execSync('git', ['status', '-b', '-s', '.']).split(/\n/)[0].split('...')[0].split(' ')[1].trim();
const REPO = (Package.repository?.url ?? '').split(/[.]git$/)[0];
const GIT_SRC_ROOT = `${REPO}/tree/${PRIMARY_BRANCH}`;

export class DocCliUtil {
  /**
   * Initialize for doc gen
   */
  static async init() {
    process.env.TRV_SRC_LOCAL = '^doc';
    process.env.TRV_RESOURCES = 'doc/resources';

    await CompileCliUtil.compile();

    process.env.TRV_DEBUG = '0';
    process.env.TRV_LOG_PLAIN = '1';

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');
  }

  /**
   * Retrieve the doc renderer
   * @param fmt
   */
  static async getRenderer(fmt: string) {
    fmt = fmt.replace(/^[.]/, ''); // Strip leading .
    const { Html } = await import('../../src/render/html');
    const { Markdown } = await import('../../src/render/markdown');
    const renderers = { [Html.ext]: Html, [Markdown.ext]: Markdown };
    const renderer = renderers[fmt];
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

    const preamble = `<!-- This file was generated by the framweork and should not be modified directly -->
    <!-- Please modify ${file.replace(/.*travetto\//, '%GIT%/')} and execute "npm run docs" to rebuild -->`;

    const doc: DocumentContext = await import(file);
    const module = this.getPackageName();
    const content = `${renderer.render(doc.text)}`.replace(/\n{3,100}/msg, '\n\n');
    const header = doc.header !== false ? renderer.render(Header()) : '';
    const toc = doc.toc && 'nodes' in doc.text ? renderer.toc(doc.toc,
      doc.text.nodes
        .filter(x => x._type === 'section')
        .map(x => {
          const title = (x as AllType & { _type: 'section' }).title;
          return ({ _type: 'anchor', title, fragment: title });
        })
    ) : '';

    const outputContext = { content, toc, header, preamble, module };

    const output = (doc.finalize && doc.finalize[renderer.ext]) ?
      doc.finalize[renderer.ext](outputContext) :
      renderer.finalize(outputContext);

    return output.replace(/%GIT%/g, GIT_SRC_ROOT);
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
  static async watchFile(file: string, cb: (ev: unknown) => void) {
    const { Watcher } = await import('@travetto/watch');
    const { Compiler } = await import('@travetto/compiler');

    new Watcher(__dirname, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', e => {
        Compiler.unload(FsUtil.resolveUnix(file));
        cb(e);
      });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }
}