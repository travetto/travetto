import { isJSXElement, JSXElement, createFragment, JSXFragmentType, JSXChild } from '@travetto/email-inky/support/jsx-runtime';
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
    input: JSXChild[] | JSXChild | null | undefined,
    stack: JSXElement[] = []
  ): Promise<string> {
    if (input === null || input === undefined) {
      return '';
    } else if (Array.isArray(input)) {
      const out: string[] = [];
      const nextStack = [...stack, { key: '', props: { children: input }, type: JSXFragmentType }];
      for (const node of input) {
        out.push(await this.#render(ctx, renderer, node, nextStack));
      }
      return out.join('');
    } else if (isJSXElement(input)) {
      let final: JSXElement = input;
      // Render simple element if needed
      if (typeof input.type === 'function' && input.type !== JSXFragmentType) {
        const out = castTo<Function>(input.type)(input.props);
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
          node: final, props: final.props, recurse, stack, context: ctx
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
      return `${input}`;
    }
  }

  static createState<K extends keyof typeof c>(
    ctx: RenderContext,
    renderer: RenderProvider<RenderContext>,
    state: RenderState<JSXElement, RenderContext>,
    key: K,
    props: JSXElementByFn<K>['props'],
  ): RenderState<JSXElementByFn<K>, RenderContext> {
    const node = ctx.createElement(key, props);
    const newStack: JSXElement[] = castTo([...state.stack, node]);
    return { ...state, node, props: node.props, recurse: () => this.#render(ctx, renderer, node.props.children ?? [], newStack) };
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