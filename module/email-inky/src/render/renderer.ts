import { isJSXElement, JSXElement, createFragment, JSXFragmentType } from '@travetto/email-inky/jsx-runtime';

import { EMPTY_ELEMENT, getComponentName, JSXElementByFn, c } from '../components';
import { DocumentShape, RenderProvider, RenderState } from '../types';
import { RenderContext } from './context';
import { JSXChild } from '../../jsx-runtime';

/**
 * Inky Renderer
 */
export class InkyRenderer {

  static async #render(
    ctx: RenderContext,
    renderer: RenderProvider<RenderContext>,
    node: JSXChild[] | JSXChild | null | undefined,
    stack: JSXElement[] = []
  ): Promise<string> {
    if (node === null || node === undefined) {
      return '';
    } else if (Array.isArray(node)) {
      const out: string[] = [];
      const nextStack = [...stack, { key: '', props: { children: node }, type: 'Fragment' }];
      for (const el of node) {
        out.push(await this.#render(ctx, renderer, el, nextStack));
      }
      return out.join('');
    } else if (isJSXElement(node)) {
      let final: JSXElement = node;
      // Render simple element if needed
      if (typeof node.type === 'function') {
        // @ts-expect-error
        const out = node.type(node.props);
        final = out !== EMPTY_ELEMENT ? out : final;
      }

      if (final.type === createFragment || final.type === JSXFragmentType) {
        return this.#render(ctx, renderer, final.props.children ?? [], stack);
      }

      if (Array.isArray(final)) {
        return this.#render(ctx, renderer, final, stack);
      }

      const name = getComponentName(final.type);
      if (name in renderer) {
        const recurse = (): Promise<string> => this.#render(ctx, renderer, final.props.children ?? [], [...stack, final]);
        // @ts-expect-error
        const state: RenderState<JSXElement, RenderContext> = {
          el: final, props: final.props, recurse, stack, context: ctx
        };
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        state.createState = (key, props) => this.createState(ctx, renderer, state, key, props);
        // @ts-expect-error
        return renderer[name](state);
      } else {
        console.log(final);
        throw new Error(`Unknown element: ${final.type}`);
      }
    } else {
      return `${node}`;
    }
  }

  static createState<K extends keyof typeof c>(
    ctx: RenderContext,
    renderer: RenderProvider<RenderContext>,
    state: RenderState<JSXElement, RenderContext>,
    key: K,
    props: JSXElementByFn<K>['props'],
    // @ts-expect-error
  ): RenderState<JSXElementByFn<K>, RenderContext> {
    const el = ctx.createElement(key, props);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const newStack = [...state.stack, el] as JSXElement[];
    return { ...state, el, props: el.props, recurse: () => this.#render(ctx, renderer, el.props.children ?? [], newStack) };
  }

  /**
   * Render a context given a specific renderer
   * @param renderer
   */
  static async render(root: DocumentShape, provider: RenderProvider<RenderContext>): Promise<string> {
    const ctx = new RenderContext();
    let par: JSXElement;

    // We are at the root element
    if (isJSXElement(root.text)) {
      par = root.text;
    } else {
      par = { props: { children: Array.isArray(root.text) ? root.text : [] }, type: '', key: '' };
    }
    const text = await this.#render(ctx, provider, root.text, [par]);

    let cleaned = `${text.replace(/\n{3,100}/msg, '\n\n').trim()}\n`;
    if (root.wrap) {
      cleaned = await root.wrap?.(cleaned);
    }
    return provider.finalize(cleaned, ctx);
  }
}