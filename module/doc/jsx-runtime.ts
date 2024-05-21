import { ConcreteClass } from '@travetto/base';

type JSXChild = JSXElement | number | bigint | boolean | object | string;
type JSXProps = { children?: JSXChild | JSXChild[] | null };

export type JSXComponentFunction<P extends {} = {}> = (props: P & JSXProps, ...args: unknown[]) => (JSXElement | null);

export const JSXRuntimeTag = Symbol.for('@travetto/doc:jsx-runtime');
export class JSXFragmentType { }

let id = 0;

/** Simple JSX Element */
export interface JSXElement<
  T extends string | ConcreteClass | JSXComponentFunction<P> = string | ConcreteClass | JSXComponentFunction,
  P extends {} = {},
> {
  [JSXRuntimeTag]?: { id: number };
  type: T;
  key: string;
  props: P & JSXProps;
}

export type ValidHtmlTags = 'strong' | 'em' | 'br' | 'hr' | 'li' | 'ul' | 'ol' |
  'h2' | 'h3' | 'h4' | 'td' | 'tr' | 'table' | 'thead' | 'tbody';

type BasicElements = { [K in ValidHtmlTags]: JSX.IntrinsicAttributes };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface Element extends JSXElement { }
    interface IntrinsicAttributes { }
    interface IntrinsicElements extends BasicElements { }
  }
}

let createFrag: Function | undefined = undefined;

export function createElement<T extends string | ConcreteClass | JSXComponentFunction<P>, P extends {}>(
  type: T, props: P & JSXProps
): JSXElement<T, P> {
  type = (type === createFrag ? JSXFragmentType : type) as T;
  return { [JSXRuntimeTag]: { id: (id += 1) }, type, key: '', props };
}

export function createFragment<P extends {}>(props: P & JSXProps): JSXElement<typeof JSXFragmentType, P> {
  return createElement(JSXFragmentType, props);
}

createFrag = createFragment;

export const jsx = createElement;
export const jsxs = createElement;
export const Fragment = createFragment;
export function isJSXElement(el: unknown): el is JSXElement {
  return el !== undefined && el !== null && typeof el === 'object' && JSXRuntimeTag in el;
}