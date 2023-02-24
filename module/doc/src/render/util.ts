import { RootIndex, PackageUtil, path } from '@travetto/manifest';

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
    if (RootIndex.manifest.moduleType === 'commonjs') {
      const mod = RootIndex.getFromSource(file)!.outputFile;
      delete require.cache[path.toNative(mod)];
    }
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

    let mod = RootIndex.getFromSource(file)?.import;

    if (RootIndex.manifest.moduleType === 'module') {
      mod = `${mod}?ts=${Date.now()}`;
    }

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

    const manifestPkg = PackageUtil.readPackage(RootIndex.getModule('@travetto/manifest')!.sourcePath);

    const mf = RootIndex.manifest;

    const pkg = PackageUtil.readPackage(mf.workspacePath);
    const mainPath = path.resolve(mf.workspacePath, mf.mainFolder);
    const repoBaseUrl = pkg.travetto?.docBaseUrl ?? mainPath;

    const ctx = new RenderContext(
      file,
      path.resolve(pkg.travetto?.docRoot ?? mf.workspacePath),
      repoBaseUrl,
      repoBaseUrl.includes('travetto.github') ? repoBaseUrl : manifestPkg.travetto!.docBaseUrl!
    );
    const content = renderers[fmt].render(root, ctx).replace(/\n{3,100}/msg, '\n\n').trim();
    const preamble = renderers[fmt].render(ctx.preamble, ctx);
    return `${preamble}\n${wrap?.[fmt]?.(content) ?? content}\n`;
  }
}