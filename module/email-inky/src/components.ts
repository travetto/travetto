import { JSXElement, JSXComponentFunction as CompFn } from '@travetto/email-inky/jsx-runtime';
import { TypedObject } from '@travetto/runtime';

const EMPTY: JSXElement = { type: '', key: '', props: {} };

export const Column: CompFn<{
  valign?: string;
  align?: string;
  small?: number; smallOffset?: number; hideSmall?: boolean;
  large?: number; largeOffset?: number; hideLarge?: boolean;
  noExpander?: boolean;
}> = () => EMPTY;
export const Title: CompFn<{}> = () => EMPTY;
export const Summary: CompFn<{}> = () => EMPTY;
export const HLine: CompFn<{}> = () => EMPTY;
export const Row: CompFn<{}> = () => EMPTY;
export const Button: CompFn<{ href: string, target?: string, expanded?: boolean }> = () => EMPTY;
export const Container: CompFn<{}> = () => EMPTY;
export const BlockGrid: CompFn<{ up?: number }> = () => EMPTY;
export const Menu: CompFn<{}> = () => EMPTY;
export const Item: CompFn<{ href: string, target?: string }> = () => EMPTY;
export const Center: CompFn<{}> = () => EMPTY;
export const Callout: CompFn<{}> = () => EMPTY;
export const Spacer: CompFn<{ small?: number, large?: number, size?: number }> = () => EMPTY;
export const Wrapper: CompFn<{}> = () => EMPTY;

export const If: CompFn<{ attr: string }> = () => EMPTY;
export const Value: CompFn<{ attr: string, raw?: boolean }> = () => EMPTY;
export const Unless: CompFn<{ attr: string }> = () => EMPTY;
export const For: CompFn<{ attr: string }> = () => EMPTY;
export const InkyTemplate: CompFn<{}> = () => EMPTY;

export const c = {
  Wrapper, Container, InkyTemplate,
  Column, Title, Summary, HLine, Row, Button,
  BlockGrid, Menu, Item, Center, Callout, Spacer,
  If, Unless, For, Value
} as const;

for (const key of TypedObject.keys(c)) {
  Object.defineProperty(c[key], 'toString', { value: () => `<${key} />` });
}

type C = typeof c;

// @ts-expect-error
export type JSXElementByFn<K extends keyof C> = JSXElement<C[K], Parameters<C[K]>[0]>;
export type JSXElements = { [K in keyof C]: JSXElementByFn<K>; };

export const EMPTY_ELEMENT = EMPTY;

const invertedC = new Map<Function, string>(TypedObject.entries(c).map(([name, cls]) => [cls, name] as const));

export function getComponentName(fn: Function | string): string {
  if (typeof fn === 'string') {
    return fn;
  }
  return invertedC.get(fn) ?? fn.name;
}
