import { isJSXElement, JSXElement, createFragment, JSXFragmentType, JSXChild } from '@travetto/email-inky/jsx-runtime.ts';

import { castTo } from '@travetto/runtime';

import { EMPTY_ELEMENT, getComponentName, JSXElementByFn, c } from '../components.ts';
import { RenderProvider, RenderState } from '../types.ts';
import { RenderContext, RenderContextInit } from './context.ts';

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
      const nextStack = [...stack, { key: '', props: { children: node }, type: JSXFragmentType }];
      for (const el of node) {
        out.push(await this.#render(ctx, renderer, el, nextStack));
      }
      return out.join('');
    } else if (isJSXElement(node)) {
      let final: JSXElement = node;
      // Render simple element if needed
      if (typeof node.type === 'function' && node.type !== JSXFragmentType) {
        const out = castTo<Function>(node.type)(node.props);
        final = out !== EMPTY_ELEMENT ? out : final;
      }

      if (final.type === JSXFragmentType) {
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
    const newStack: JSXElement[] = castTo([...state.stack, el]);
    return { ...state, el, props: el.props, recurse: () => this.#render(ctx, renderer, el.props.children ?? [], newStack) };
  }

  /**
   * Render a context given a specific renderer
   * @param renderer
   */
  static async render(
    root: JSXElement,
    provider: RenderProvider<RenderContext>,
    context: RenderContextInit,
    isRoot = true
  ): Promise<string> {
    const ctx = new RenderContext(context);
    const par: JSXElement = root.type === JSXFragmentType ? root : createFragment({ children: [root] });
    const text = await this.#render(ctx, provider, par, []);
    return provider.finalize(text, ctx, isRoot);
  }
}