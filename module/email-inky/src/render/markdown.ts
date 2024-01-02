import { JSXElement } from '@travetto/email-inky/jsx-runtime';
import { RenderProvider, RenderState } from '../types';
import { RenderContext } from './context';

const visit = ({ recurse }: RenderState<JSXElement, RenderContext>): Promise<string> => recurse();
const ignore = async ({ recurse: _ }: RenderState<JSXElement, RenderContext>): Promise<string> => '';

export const Markdown: RenderProvider<RenderContext> = {
  finalize: (text) => {
    text = text
      .replace(/(\[[^\]]+\]\([^)]+\))([A-Za-z0-9$]+)/g, (_, link, v) => v === 's' ? _ : `${link} ${v}`)
      .replace(/(\S)\n(#)/g, (_, l, r) => `${l}\n\n${r}`);
    return text;
  },

  For: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  If: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Unless: async ({ recurse, props }) => `{{^${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Value: async ({ props }) => props.raw ? `{{{${props.attr}}}}` : `{{${props.attr}}}`,

  strong: async ({ recurse }) => `**${await recurse()}**`,
  hr: async () => '\n------------------\n',
  HLine: async () => '\n------------------\n',
  br: async () => '\n\n',
  p: async ({ recurse }) => `${await recurse()}\n\n`,
  em: async ({ recurse }) => `*${await recurse()}*`,
  ul: async ({ recurse }) => `\n${await recurse()}`,
  ol: async ({ recurse }) => `\n${await recurse()}`,
  li: async ({ recurse, stack }) => {
    const parent = stack.reverse().find(x => x.type === 'ol' || x.type === 'ul');
    const depth = stack.filter(x => x.type === 'ol' || x.type === 'ul').length;
    return `${'   '.repeat(depth)}${(parent && parent.type === 'ol') ? '1.' : '* '} ${await recurse()}\n`;
  },
  th: async ({ recurse }) => `|${await recurse()}`,
  td: async ({ recurse }) => `|${await recurse()}`,
  tr: async ({ recurse }) => `${await recurse()}|\n`,
  thead: async ({ recurse }) => {
    const row = await recurse();
    return `${row}${row.replace(/[^|\n]/g, '-')}`;
  },
  h1: async ({ recurse }) => `\n# ${await recurse()}\n\n`,
  h2: async ({ recurse }) => `\n## ${await recurse()}\n\n`,
  h3: async ({ recurse }) => `\n### ${await recurse()}\n\n`,
  h4: async ({ recurse }) => `\n#### ${await recurse()}\n\n`,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  a: async ({ recurse, props }) => `\n[${await recurse()}](${(props as { href: string }).href})\n`,
  Button: async ({ recurse, props }) => `\n[${await recurse()}](${props.href})\n`,

  InkyTemplate: visit,
  Callout: visit, Center: visit, Container: visit,
  Column: visit, Wrapper: visit, Row: visit, BlockGrid: visit,

  Menu: async ({ recurse }) => `\n${await recurse()}`,
  Item: async ({ recurse, stack, props }) => {
    const depth = stack.filter(x => x.type === 'Menu').length;
    return `${'   '.repeat(depth)}* [${await recurse()}](${props.href})\n`;
  },
  Spacer: async () => '\n\n',

  Summary: ignore, Title: ignore,
  img: ignore,
  div: visit, title: visit, span: visit, center: visit, table: visit, tbody: visit, small: visit
};
