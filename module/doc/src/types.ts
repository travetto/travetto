import { JSXElement, ValidHtmlTags } from '@travetto/doc/jsx-runtime';
import { JSXElementByFn, c } from './jsx';

export type Wrapper = Record<string, (cnt: string) => string>;

/**
 * Document file shape
 * @concrete
 */
export interface DocumentShape {
  text: JSXElement | JSXElement[] | (() => Promise<JSXElement | JSXElement[]>);
  wrap?: Wrapper;
}

export type RenderState<T extends JSXElement, C> = {
  el: T;
  props: T['props'];
  recurse: () => Promise<string | undefined>;
  stack: JSXElement[];
  // @ts-expect-error
  createState: <K extends keyof typeof c>(key: K, props: JSXElementByFn<K>['props']) => RenderState<JSXElementByFn<K>, C>;
  context: C;
};

/**
 * Renderer
 */
export type RenderProvider<C> =
  {
    ext: string;
    finalize: (text: string, ctx: C) => string;
  } &
  { [K in ValidHtmlTags]: (state: RenderState<JSXElement<K>, C>) => Promise<string>; } &
  // @ts-expect-error
  { [K in keyof typeof c]: (state: RenderState<JSXElementByFn<K>, C>) => Promise<string>; };
