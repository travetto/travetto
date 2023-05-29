import { JSXChild, JSXElement, ValidHtmlTags } from '../jsx-runtime';
import { JSXElementByFn, c } from './components';

export type Wrapper = Record<string, (cnt: string) => string>;

/**
 * Document file shape
 */
export interface DocumentShape {
  text: JSXChild | JSXChild[] | undefined | null;
  wrap?: (content: string) => string;
}

export type RenderState<T extends JSXElement, C> = {
  el: T;
  props: T['props'];
  recurse: () => Promise<string>;
  stack: JSXElement[];
  // @ts-expect-error
  createState: <K extends keyof typeof c>(key: K, props: JSXElementByFn<K>['props']) => RenderState<JSXElementByFn<K>, C>;
  context: C;
};

/**
 * Renderer
 */
export type RenderProvider<C> =
  { finalize: (text: string, ctx: C) => string } &
  { [K in ValidHtmlTags]: (state: RenderState<JSXElement<K>, C>) => Promise<string>; } &
  // @ts-expect-error
  { [K in keyof typeof c]: (state: RenderState<JSXElementByFn<K>, C>) => Promise<string>; };
