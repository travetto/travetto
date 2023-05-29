import { JSXElement } from '@travetto/email-inky/jsx-runtime';
import { RenderProvider, RenderState } from '../types';
import { RenderContext } from './context';

const empty = async (): Promise<string> => '';
const visit = ({ recurse }: RenderState<JSXElement, RenderContext>): Promise<string> => recurse();

export const Subject: RenderProvider<RenderContext> = {
  finalize: text => text
    .replace(/[\[]{2}([^\]]+)[\]]{2}/gm, (_, t) => `{{${t}}}`),

  For: async ({ recurse, props }) => `{{#${props.value}}}${await recurse()}{{/${props.value}}}`,
  If: async ({ recurse, props }) => `{{#${props.value}}}${await recurse()}{{/${props.value}}}`,
  Unless: async ({ recurse, props }) => `{{^${props.value}}}${await recurse()}{{/${props.value}}}`,
  Title: visit,

  title: visit, span: visit, strong: visit, center: visit, em: visit,

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
