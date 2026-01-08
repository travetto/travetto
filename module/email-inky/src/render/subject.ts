import type { JSXElement } from '../../support/jsx-runtime.ts';
import type { RenderProvider, RenderState } from '../types.ts';
import type { RenderContext } from './context.ts';

const empty = async (): Promise<string> => '';
const visit = ({ recurse }: RenderState<JSXElement, RenderContext>): Promise<string> => recurse();

export const Subject: RenderProvider<RenderContext> = {
  finalize: (text) => text,

  For: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  If: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Unless: async ({ recurse, props }) => `{{^${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Value: async ({ props }) => `{{${props.attr}}}`,
  Title: visit,
  InkyTemplate: visit,

  title: visit, span: visit, strong: visit, center: visit, em: visit, p: visit, small: visit,

  Summary: empty, Button: empty,
  Callout: empty, Center: empty, HLine: empty,
  Menu: empty, Item: empty,
  Column: empty, Row: empty, BlockGrid: empty, Spacer: empty,
  Wrapper: empty, Container: empty,

  div: empty, hr: empty, br: empty, a: empty, img: empty,
  ul: empty, ol: empty, li: empty,
  table: empty, tbody: empty, td: empty, th: empty, tr: empty, thead: empty,
  h1: empty, h2: empty, h3: empty, h4: empty,
};
