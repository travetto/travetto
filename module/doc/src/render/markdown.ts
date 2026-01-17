import fs from 'node:fs/promises';

import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { PackageUtil } from '@travetto/manifest';

import type { RenderProvider } from '../types.ts';
import { c, getComponentName } from '../jsx.ts';
import { MODULES } from '../mapping/module.ts';
import { LIBRARIES } from '../mapping/library.ts';
import type { RenderContext } from './context.ts';
import { DocResolveUtil } from '../util/resolve.ts';

export const Markdown: RenderProvider<RenderContext> = {
  ext: 'md',
  finalize: (text, context) => {
    const brand = `<!-- ${context.generatedStamp} -->\n<!-- ${context.rebuildStamp} -->`;
    const cleaned = text
      .replace(/(\[[^\]]+\]\([^)]+\))([A-Za-z0-9$]+)/g, (_, link, value) => value === 's' ? _ : `${link} ${value}`)
      .replace(/(\S)\n(#)/g, (_, left, right) => `${left}\n\n${right}`);
    return `${brand}\n${cleaned}`;
  },
  strong: async ({ recurse }) => `**${await recurse()}**`,
  hr: async () => '\n------------------\n',
  br: async () => '\n\n',
  em: async ({ recurse }) => `*${await recurse()}*`,
  ul: async ({ recurse }) => `\n${await recurse()}\n`,
  ol: async ({ recurse }) => `\n${await recurse()}\n`,
  li: async ({ recurse, stack }) => {
    const parent = stack.toReversed().find(node => node.type === 'ol' || node.type === 'ul');
    const depth = stack.filter(node => node.type === 'ol' || node.type === 'ul').length;
    return `${'   '.repeat(depth)}${(parent && parent.type === 'ol') ? '1.' : '* '} ${await recurse()}\n`;
  },
  table: async ({ recurse }) => `${await recurse()}`,
  tbody: async ({ recurse }) => `${await recurse()}`,
  td: async ({ recurse }) => `|${await recurse()}`,
  tr: async ({ recurse }) => `${await recurse()}|\n`,
  thead: async ({ recurse }) => {
    const row = await recurse();
    return `${row}${row?.replace(/[^|\n]/g, '-')}`;
  },
  h2: async ({ recurse }) => `\n## ${await recurse()}\n\n`,
  h3: async ({ recurse }) => `\n### ${await recurse()}\n\n`,
  h4: async ({ recurse }) => `\n#### ${await recurse()}\n\n`,
  Execution: async ({ context, node, props, createState }) => {
    const output = await context.execute(node);
    const displayCmd = props.config?.formatCommand?.(props.cmd, props.args ?? []) ??
      `${node.props.cmd} ${(node.props.args ?? []).join(' ')}`;
    const state = createState('Terminal', {
      language: 'bash',
      title: node.props.title,
      src: [`$ ${displayCmd}`, '', context.cleanText(output)].join('\n')
    });
    return Markdown.Terminal(state);
  },
  Install: async ({ context, node }) =>
    `\n\n**Install: ${node.props.title}**
\`\`\`bash
${PackageUtil.getInstallInstructions(node.props.pkg, true)}
\`\`\`
`,
  Code: async ({ context, node, props }) => {
    DocResolveUtil.applyCodePropDefaults(node.props);

    const name = getComponentName(node.type);
    const content = await context.resolveCode(node);
    let lang = props.language ?? content.language;
    if (!lang) {
      if (node.type === c.Terminal) {
        lang = 'bash';
      } else if (node.type === c.Code) {
        lang = 'typescript';
      }
    }
    return `\n\n**${name}: ${props.title}**
\`\`\`${lang}
${context.cleanText(content.text)}
\`\`\`\n\n`;
  },
  Terminal: state => Markdown.Code(state),
  Config: state => Markdown.Code(state),

  Section: async ({ node, recurse }) => `\n## ${node.props.title}\n${await recurse()}\n`,
  SubSection: async ({ node, recurse }) => `\n### ${node.props.title}\n${await recurse()}\n`,
  SubSubSection: async ({ node, recurse }) => `\n#### ${node.props.title}\n${await recurse()}\n`,

  Command: state => Markdown.Input(state),
  Method: state => Markdown.Input(state),
  Path: state => Markdown.Input(state),
  Class: state => Markdown.Input(state),
  Field: state => Markdown.Input(state),
  Input: async ({ props }) => `\`${props.name}\``,

  Anchor: async ({ context, props }) => `[${props.title}](#${context.getAnchorId(props.href)})`,
  File: state => Markdown.Ref(state),
  Ref: async ({ context, props }) => `[${props.title}](${context.link(props.href, props)})`,

  CodeLink: async ({ context, props, node }) => {
    const target = await context.resolveCodeLink(node);
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
    const module = state.node.props.module ?? Runtime.main.name;
    const pkg = PackageUtil.readPackage(RuntimeIndex.getModule(module)!.sourcePath);
    const title = pkg.travetto?.displayName ?? pkg.name;
    const desc = pkg.description;
    let install = '';
    if (state.node.props.install !== false) {
      const sub = state.createState('Install', { title: pkg.name, pkg: pkg.name });
      install = await Markdown.Install(sub);
    }
    return `# ${title}\n${desc ? `## ${desc}\n` : ''}${install}\n`;
  },
  Module: async ({ props, context }) => {
    const config = MODULES[props.name];
    return `[${config.displayName}](${context.link(config.folder, config)}#readme "${config.description}")`;
  },
  Library: async ({ props }) => {
    const config = LIBRARIES[props.name];
    return `[${config.title}](${config.href})`;
  }
};
