import { JSXElement, JSXComponentFunction as CompFn } from '@travetto/email-inky/jsx-runtime';
import { TypedObject } from '@travetto/base';

const EMPTY: JSXElement = { type: '', key: '', props: {} };

export const Column: CompFn<{ valign?: string, align?: string, small?: number, large?: number, noExpander?: boolean }> = () => EMPTY;
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

export const If: CompFn<{ value: string }> = () => EMPTY;
export const Unless: CompFn<{ value: string }> = () => EMPTY;
export const For: CompFn<{ value: string }> = () => EMPTY;

export const c = {
  Wrapper, Container,
  Column, Title, Summary, HLine, Row, Button,
  BlockGrid, Menu, Item, Center, Callout, Spacer,
  If, Unless, For
} as const;

type C = typeof c;

// @ts-expect-error
export type JSXElementByFn<K extends keyof C> = JSXElement<C[K], Parameters<C[K]>[0]>;
export type JSXElements = { [K in keyof C]: JSXElementByFn<K>; };

export const EMPTY_ELEMENT = EMPTY;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const invertedC = new Map<Function, string>(TypedObject.entries(c).map(p => [p[1], p[0]] as [CompFn, string]));

export function getComponentName(fn: Function | string): string {
  if (typeof fn === 'string') {
    return fn;
  }
  return invertedC.get(fn) ?? fn.name;
}
