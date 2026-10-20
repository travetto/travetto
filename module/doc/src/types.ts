import type { IndexedModule } from '@travetto/manifest';

import type { JSXElement, ValidHtmlTags } from '../support/jsx-runtime.ts';
import type { c, JSXElementByFn } from './jsx.ts';

export type Wrapper = Record<string, (cnt: string) => string>;

/**
 * Render context provided to doc lifecycle hooks
 */
export interface DocRenderContext {
  module: IndexedModule;
  rendered: Record<string, string>;
  files: Record<string, string>;
}

/**
 * Hook for customizing doc generation outputs
 */
export interface DocRenderHook {
  afterRender?(context: DocRenderContext): Promise<void> | void;
}

/**
 * Document file shape
 * @concrete
 */
export interface DocumentShape {
  text: JSXElement | JSXElement[] | (() => Promise<JSXElement | JSXElement[]>);
  wrap?: Wrapper;
}

export type RenderState<T extends JSXElement, C> = {
  node: T;
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
export type RenderProvider<C> = {
  ext: string;
  finalize: (text: string, ctx: C) => string;
} & { [K in ValidHtmlTags]: (state: RenderState<JSXElement<K>, C>) => Promise<string> } & {
  // @ts-expect-error
  [K in keyof typeof c]: (state: RenderState<JSXElementByFn<K>, C>) => Promise<string>;
};
