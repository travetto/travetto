import * as path from 'path';

import { EnvUtil, ExecUtil, Package, PathUtil } from '@travetto/boot/src';

import { AllTypeMap } from './node-types';
import { DocumentContext, Renderer } from './render/types';
import * as n from './nodes';

/**
 * Tools for generating final output
 */
export class GenerateUtil {
  static getBranchName() {
    return ExecUtil.execSync('git', ['status', '-b', '-s', '.']).split(/\n/)[0].split('...')[0].split(' ')[1].trim();
  }

  static getPackageName() {
    return path.basename(PathUtil.cwd);
  }

  /**
   * Retrieve the doc renderer
   * @param fmt
   */
  static async getRenderer(fmt: string) {
    fmt = fmt.replace(/^[.]/, ''); // Strip leading .
    const { Html } = await import('./render/html');
    const { Markdown } = await import('./render/markdown');
    const renderers = { [Html.ext]: Html, [Markdown.ext]: Markdown };
    const renderer = renderers[fmt];
    if (!renderer) {
      throw new Error(`Unknown renderer with format: ${fmt}`);
    }
    return renderer;
  }

  /**
   * Generate the text
   * @param renderer
   */
  static async generate(file: string, renderer: Renderer) {
    file = PathUtil.resolveUnix(file);

    // Get repo information
    const gitRepo = (Package.repository?.url ?? '').split(/[.]git$/)[0];
    const gitRoot = `${gitRepo}/tree/${EnvUtil.get('TRV_DOC_BRANCH', this.getBranchName())}`;

    // General info
    const module = this.getPackageName();

    const preamble = `<!-- This file was generated by the framweork and should not be modified directly -->
<!-- Please modify ${file.replace(/.*travetto\//, `${gitRoot}/`)} and execute "npm run docs" to rebuild -->`;

    const doc: DocumentContext = await import(file);
    // Build content
    const toc = n.Ordered(
      ...(doc.text as AllTypeMap['Group']).nodes
        .filter(x => x._type === 'section')
        .map(x => {
          const { title } = x as AllTypeMap['Section'];
          return n.Anchor(title, title);
        })
    );
    const content = renderer.render(doc.text, { toc, gitRoot, module }).trim();

    const output = doc.assemble?.[renderer.ext]?.(content) ?? renderer.assemble?.(content) ?? content;
    return `${preamble}\n${output.replace(/\n{3,100}/msg, '\n\n').trim()}\n`;
  }

  /**
   * Get the output location
   * @param output
   */
  static async getOutputLocation(output: string) {
    const root = PathUtil.resolveUnix(output);
    const name = this.getPackageName();
    return root.replace(/%MOD/g, name);
  }
}