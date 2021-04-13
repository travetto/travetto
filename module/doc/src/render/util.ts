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

  static purge(file: string) {
    this.#imported.delete(file);
  }

  /**
   * Render content of file and format
   * @param file
   * @param fmt
   * @returns
   */
  static async render(file: string, fmt: string = Markdown.ext) {
    fmt = fmt.replace(/^[.]/, ''); // Strip leading .
    if (!renderers[fmt]) {
      throw new Error(`Unknown renderer with format: ${fmt}`);
    }

    const res = (await import(file)) as DocumentShape;

    if (!this.#imported.has(file)) {
      this.#imported.set(file, {
        wrap: res.wrap,
        root: ('_type' in res.text ? res.text : await res.text()) as AllType
      });
    }

    const { wrap, root } = this.#imported.get(file)!;

    const ctx = new RenderContext(file);
    const content = renderers[fmt].render(root as AllType, ctx).replace(/\n{3,100}/msg, '\n\n').trim();
    const preamble = renderers[fmt].render(ctx.preamble, ctx);
    return `${preamble}\n${wrap?.[fmt]?.(content) ?? content}\n`;
  }
}