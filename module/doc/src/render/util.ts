import { RootIndex, PackageUtil } from '@travetto/manifest';

import { RenderContext } from './context';
import { Html } from './html';
import { Markdown } from './markdown';
import { DocumentShape, Wrapper } from '../types';
import { AllType } from '../nodes';

const renderers = { [Html.ext]: Html, [Markdown.ext]: Markdown };

/**
 * Render utilities
 */
export class RenderUtil {

  static #imported = new Map<string, { root: AllType, wrap?: Wrapper }>();

  static purge(file: string): void {
    this.#imported.delete(file);
  }

  /**
   * Render content of file and format
   * @param file
   * @param fmt
   * @returns
   */
  static async render(file: string, fmt: string = Markdown.ext): Promise<string> {
    fmt = fmt.replace(/^[.]/, ''); // Strip leading .
    if (!renderers[fmt]) {
      throw new Error(`Unknown renderer with format: ${fmt}`);
    }

    const mod = RootIndex.getFromSource(file)?.import;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = await import(mod!) as DocumentShape;

    if (!this.#imported.has(file)) {
      this.#imported.set(file, {
        wrap: res.wrap,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        root: await res.text() as AllType
      });
    }

    const { wrap, root } = this.#imported.get(file)!;

    const manifestPkg = PackageUtil.readPackage(RootIndex.getModule('@travetto/manifest')!.source);

    const mf = RootIndex.manifest;

    const repoBaseUrl = (mf.monoRepo ?
      PackageUtil.readPackage(mf.workspacePath).travetto?.docBaseUrl :
      undefined
    ) ?? mf.mainPath;

    const ctx = new RenderContext(file,
      mf.workspacePath,
      repoBaseUrl,
      repoBaseUrl.includes('travetto.github') ? repoBaseUrl : manifestPkg.travetto!.docBaseUrl!
    );
    const content = renderers[fmt].render(root, ctx).replace(/\n{3,100}/msg, '\n\n').trim();
    const preamble = renderers[fmt].render(ctx.preamble, ctx);
    return `${preamble}\n${wrap?.[fmt]?.(content) ?? content}\n`;
  }
}