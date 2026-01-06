import { castTo, type Class } from '@travetto/runtime';

type JSXChild = JSXElement | number | bigint | boolean | object | string;
type JSXProps = { children?: JSXChild | JSXChild[] | null };

export type JSXComponentFunction<P extends {} = {}> = (props: P & JSXProps, ...args: unknown[]) => (JSXElement | null);

export const JSXRuntimeTag = Symbol.for('@travetto/doc:jsx-runtime');
export class JSXFragmentType { }

let id = 0;

/** Simple JSX Element */
export interface JSXElement<
  T extends string | Class | JSXComponentFunction<P> = string | Class | JSXComponentFunction,
  P extends {} = {},
> {
  [JSXRuntimeTag]?: { id: number };
  type: T;
  key: string;
  props: P & JSXProps;
}

export type ValidHtmlTags = 'strong' | 'em' | 'br' | 'hr' | 'li' | 'ul' | 'ol' |
  'h2' | 'h3' | 'h4' | 'td' | 'tr' | 'table' | 'thead' | 'tbody';

let createFrag: Function | undefined = undefined;

export function createElement<T extends string | Class | JSXComponentFunction<P>, P extends {}>(
  type: T, props: P & JSXProps
): JSXElement<T, P> {
  type = castTo(type === createFrag ? JSXFragmentType : type);
  return { [JSXRuntimeTag]: { id: (id += 1) }, type, key: '', props };
}

export function createFragment<P extends {}>(props: P & JSXProps): JSXElement<typeof JSXFragmentType, P> {
  return createElement(JSXFragmentType, props);
}

createFrag = createFragment;

export const jsx = createElement;
export const jsxs = createElement;
export const Fragment = createFragment;
export function isJSXElement(value: unknown): value is JSXElement {
  return value !== undefined && value !== null && typeof value === 'object' && JSXRuntimeTag in value;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export interface Element extends JSXElement { }
  export interface IntrinsicAttributes extends JSXProps { }
  type BasicElements = { [K in ValidHtmlTags]: IntrinsicAttributes };
  export interface IntrinsicElements extends BasicElements { }
}
