import { ConcreteClass } from '@travetto/base';
import { EmailTemplateModule, EmailTemplateLocation } from '@travetto/email';

export type JSXChild = JSXElement | number | bigint | boolean | object | string;
type JSXProps = { children?: JSXChild | JSXChild[] | null, className?: string, id?: string, name?: string, dir?: string };

export type JSXComponentFunction<P extends {} = {}> = (props: P & JSXProps, ...args: unknown[]) => (JSXElement | null);

export const JSXRuntimeTag = Symbol.for('@travetto/email-inky:jsx-runtime');
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

export type ValidHtmlTags =
  'strong' | 'em' | 'br' | 'hr' | 'a' |
  'li' | 'ul' | 'ol' | 'img' | 'p' |
  'h1' | 'h2' | 'h3' | 'h4' | 'small' |
  'td' | 'tr' | 'th' | 'table' | 'thead' | 'tbody' |
  'span' | 'div' | 'center' | 'title';

type BasicElements = { [K in ValidHtmlTags]: JSX.IntrinsicAttributes };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface Element extends JSXElement { }
    interface IntrinsicAttributes {
      className?: string;
      id?: string;
      dir?: string;
      name?: string;
      src?: string | Function;
      alt?: string;
      href?: string;
      title?: string;
      height?: string;
      target?: string;
      width?: string;
      style?: string;
      align?: string;
      valign?: string;
    }
    interface IntrinsicElements extends BasicElements { }
  }
}

let createFrag: Function | undefined = undefined;

export function createElement<T extends string | ConcreteClass | JSXComponentFunction<P>, P extends {}>(
  type: T, props: P & JSXProps
): JSXElement<T, P> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  type = (type === createFrag ? JSXFragmentType : type) as T;
  return { [JSXRuntimeTag]: { id: (id += 1) }, type, key: '', props };
}

export function createRootElement<T extends string | ConcreteClass | JSXComponentFunction<P>, P extends {}>(
  type: T, props: P & JSXProps
): JSXElement<T, P> {
  const res = createElement(type, props);

  Object.assign(res, {
    prepare(loc: EmailTemplateLocation): Promise<EmailTemplateModule> {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return import('@travetto/email-inky/src/wrapper').then(v => v.prepare(res as JSXElement, loc));
    }
  });

  return res;
}

export function createFragment<P extends {}>(props: P & JSXProps): JSXElement<typeof JSXFragmentType, P> {
  return createElement(JSXFragmentType, props);
}

export const jsx = createElement;
export const jsxs = createRootElement;
export const Fragment = createFragment;
export function isJSXElement(el: unknown): el is JSXElement {
  return el !== undefined && el !== null && typeof el === 'object' && JSXRuntimeTag in el;
}

createFrag = Fragment;