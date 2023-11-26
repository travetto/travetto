import fs from 'fs/promises';
import { PackageUtil, RootIndex } from '@travetto/manifest';

import { RenderProvider } from '../types';
import { c, getComponentName } from '../jsx';
import { MOD_MAPPING } from '../mapping/mod-mapping';
import { LIB_MAPPING } from '../mapping/lib-mapping';
import { RenderContext } from './context';

export const Markdown: RenderProvider<RenderContext> = {
  ext: 'md',
  finalize: (text, context) => {
    const brand = `<!-- ${context.generatedStamp} -->\n<!-- ${context.rebuildStamp} -->`;
    const cleaned = text
      .replace(/(\[[^\]]+\]\([^)]+\))([A-Za-z0-9$]+)/g, (_, link, v) => v === 's' ? _ : `${link} ${v}`)
      .replace(/(\S)\n(#)/g, (_, l, r) => `${l}\n\n${r}`);
    return `${brand}\n${cleaned}`;
  },
  strong: async ({ recurse }) => `**${await recurse()}**`,
  hr: async () => '\n------------------\n',
  br: async () => '\n\n',
  em: async ({ recurse }) => `*${await recurse()}*`,
  ul: async ({ recurse }) => `\n${await recurse()}`,
  ol: async ({ recurse }) => `\n${await recurse()}`,
  li: async ({ recurse, stack }) => {
    const parent = stack.reverse().find(x => x.type === 'ol' || x.type === 'ul');
    const depth = stack.filter(x => x.type === 'ol' || x.type === 'ul').length;
    return `${'   '.repeat(depth)}${(parent && parent.type === 'ol') ? '1.' : '* '} ${await recurse()}\n`;
  },
  table: async ({ recurse }) => recurse(),
  tbody: async ({ recurse }) => recurse(),
  td: async ({ recurse }) => `|${await recurse()}`,
  tr: async ({ recurse }) => `${await recurse()}|\n`,
  thead: async ({ recurse }) => {
    const row = await recurse();
    return `${row}${row.replace(/[^|\n]/g, '-')}`;
  },
  h2: async ({ recurse }) => `\n## ${await recurse()}\n\n`,
  h3: async ({ recurse }) => `\n### ${await recurse()}\n\n`,
  h4: async ({ recurse }) => `\n#### ${await recurse()}\n\n`,
  Execution: async ({ context, el, props, createState }) => {
    const output = await context.execute(el);
    const displayCmd = props.config?.formatCommand?.(props.cmd, props.args ?? []) ??
      `${el.props.cmd} ${(el.props.args ?? []).join(' ')}`;
    const state = createState('Terminal', {
      language: 'bash',
      title: el.props.title,
      src: [`$ ${displayCmd}`, '', context.cleanText(output)].join('\n')
    });
    return Markdown.Terminal(state);
  },
  Install: async ({ context, el }) =>
    `\n\n**Install: ${el.props.title}**
\`\`\`bash
npm install ${el.props.pkg}

# or

yarn add ${el.props.pkg}
\`\`\`
`,
  Code: async ({ context, el }) => {
    const name = getComponentName(el.type);
    const content = await context.resolveCode(el);
    let lang = el.props.language ?? content.language;
    if (!lang) {
      if (el.type === c.Terminal) {
        lang = 'bash';
      } else if (el.type === c.Code) {
        lang = 'typescript';
      }
    }
    return `\n\n**${name}: ${el.props.title}**
\`\`\`${lang}
${context.cleanText(content.text)}
\`\`\`\n\n`;
  },
  Terminal: state => Markdown.Code(state),
  Config: state => Markdown.Code(state),

  Section: async ({ el, recurse }) => `\n## ${el.props.title}\n${await recurse()}\n`,
  SubSection: async ({ el, recurse }) => `\n### ${el.props.title}\n${await recurse()}\n`,
  SubSubSection: async ({ el, recurse }) => `\n#### ${el.props.title}\n${await recurse()}\n`,

  Command: state => Markdown.Input(state),
  Method: state => Markdown.Input(state),
  Path: state => Markdown.Input(state),
  Class: state => Markdown.Input(state),
  Field: state => Markdown.Input(state),
  Input: async ({ props }) => `\`${props.name}\``,

  Anchor: async ({ context, props }) => `[${props.title}](#${context.getAnchorId(props.href)})`,
  File: state => Markdown.Ref(state),
  Ref: async ({ context, props }) => `[${props.title}](${context.link(props.href, props)})`,

  CodeLink: async ({ context, props, el }) => {
    const target = await context.resolveCodeLink(el);
    return `[${props.title}](${context.link(target.file, target)})`;
  },

  Image: async ({ props, context }) => {
    if (!/^https?:/.test(props.href) && !(await fs.stat(props.href).catch(() => false))) {
      throw new Error(`${props.href} is not a valid location`);
    }
    return `![${props.title}](${context.link(props.href)})`;
  },
  Note: async ({ context, recurse }) => `\n\n**Note**: ${context.cleanText(await recurse())}\n`,
  Header: async ({ props }) => `# ${props.title}\n${props.description ? `## ${props.description}\n` : ''}\n`,

  StdHeader: async state => {
    const mod = state.el.props.mod ?? RootIndex.mainModuleName;
    const pkg = PackageUtil.readPackage(RootIndex.getModule(mod)!.sourcePath);
    const title = pkg.travetto?.displayName ?? pkg.name;
    const desc = pkg.description;
    let install = '';
    if (state.el.props.install !== false) {
      const sub = state.createState('Install', { title: pkg.name, pkg: pkg.name });
      install = await Markdown.Install(sub);
    }
    return `# ${title}\n${desc ? `## ${desc}\n` : ''}${install}\n`;
  },
  Mod: async ({ props, context }) => {
    const cfg = MOD_MAPPING[props.name];
    return `[${cfg.displayName}](${context.link(cfg.folder, cfg)}#readme "${cfg.description}")`;
  },
  Library: async ({ props }) => {
    const cfg = LIB_MAPPING[props.name];
    return `[${cfg.title}](${cfg.href})`;
  }
};
