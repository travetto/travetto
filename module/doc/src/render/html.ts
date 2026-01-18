import fs from 'node:fs/promises';

import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { PackageUtil } from '@travetto/manifest';

import { highlight } from './code-highlight.ts';
import type { RenderProvider, RenderState } from '../types.ts';
import { c, getComponentName } from '../jsx.ts';
import { MODULES } from '../mapping/module.ts';
import { LIBRARIES } from '../mapping/library.ts';
import type { RenderContext } from './context.ts';
import { DocResolveUtil } from '../util/resolve.ts';
import type { JSXElement } from '../../support/jsx-runtime.ts';
import { PackageDocUtil } from '../util/package.ts';

const ESCAPE_ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '{': "{{'{'}}", '}': "{{'}'}}" };
const ENTITY_REGEX = new RegExp(`[${Object.keys(ESCAPE_ENTITIES).join('')}]`, 'gm');

const stdInline = async ({ recurse, node }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${node.type}>${await recurse()}</${node.type}>`;

const std = async ({ recurse, node }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${node.type}>${await recurse()}</${node.type}>\n`;

const stdFull = async ({ recurse, node }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `\n<${node.type}>${await recurse()}</${node.type}>\n`;

export const Html: RenderProvider<RenderContext> = {
  ext: 'html',
  finalize: (text, context) => {
    const brand = `<!-- ${context.generatedStamp} -->\n<!-- ${context.rebuildStamp} -->`;
    const cleaned = text
      .replace(/(<[/](?:a)>)([A-Za-z0-9$])/g, (_, tag, value) => `${tag} ${value}`)
      .replace(/(<[uo]l>)(<li>)/g, (_, a, b) => `${a} ${b}`);
    return `${brand}\n${cleaned}`;
  },
  br: async () => '<br><br>\n',
  hr: async () => '<hr>\n',
  strong: stdInline, em: stdInline,
  h2: stdFull, h3: stdFull, h4: stdFull,
  li: std, ol: stdFull, ul: stdFull,
  table: stdFull, thead: std, tr: std, td: std, tbody: std,
  Execution: async ({ context, node, props, createState }) => {
    const output = await context.execute(node);
    const displayCmd = props.config?.formatCommand?.(props.cmd, props.args ?? []) ??
      `${node.props.cmd} ${(node.props.args ?? []).join(' ')}`;
    const sub = createState('Terminal', {
      language: 'bash',
      title: props.title,
      src: [`$ ${displayCmd}`, '', context.cleanText(output)].join('\n')
    });
    return Html.Terminal(sub);
  },
  Install: async ({ context, node }) => {
    const highlighted = highlight(`
${PackageDocUtil.getInstallInstructions(node.props.pkg, true)}
`, 'bash');

    return `\n
  <figure class="install">
    <figcaption class="install">Install ${node.props.title}
    
    </figcaption>
    <pre><code class="language-bash">${highlighted}</code></pre>
  </figure>\n\n
`;
  },
  Terminal: state => Html.Code(state),
  Config: state => Html.Code(state),
  Code: async ({ context, node, props }) => {
    DocResolveUtil.applyCodePropDefaults(node.props);

    const cls = getComponentName(node.type).replace(/^[A-Z]/g, value => value.toLowerCase());
    const content = await context.resolveCode(node);
    let link: string = '';
    if ('src' in props && content.file) {
      let linkCtx: { file: string, line?: number } = { file: content.file! };
      if (props.startRe) {
        linkCtx = await DocResolveUtil.resolveCodeLink(linkCtx.file, props.startRe);
      }
      link = `<cite><a target="_blank" href="${context.link(content.file!, linkCtx)}">Source</a></cite>`;
    }
    let lang = props.language ?? content.language;
    if (!lang) {
      if (node.type === c.Terminal) {
        lang = 'bash';
      } else if (node.type === c.Code) {
        lang = 'typescript';
      }
    }

    const highlighted = context.cleanText(highlight(content.text, lang));
    return `\n
  <figure class="${cls}">
    <figcaption class="${cls}">${props.title}\n${link}\n\n</figcaption>
    <pre><code class="language-${lang}">${highlighted}</code></pre>
  </figure>\n\n`;
  },

  Section: async ({ context, recurse, props: { title } }) =>
    `\n<h2 id="${context.getAnchorId(title)}">${title}</h2>\n\n${await recurse()}\n`,
  SubSection: async ({ context, recurse, props: { title } }) =>
    `\n<h3 id="${context.getAnchorId(title)}">${title}</h3>\n\n${await recurse()}\n`,
  SubSubSection: async ({ context, recurse, props: { title } }) =>
    `\n<h4 id="${context.getAnchorId(title)}">${title}</h4>\n\n${await recurse()}\n`,

  Command: state => Html.Input(state),
  Method: state => Html.Input(state),
  Path: state => Html.Input(state),
  Class: state => Html.Input(state),
  Field: state => Html.Input(state),
  Input: async ({ node, context }) => {
    const cls = getComponentName(node.type).replace(/^[A-Z]/g, value => value.toLowerCase());
    return `<code class="item ${cls}">${context.cleanText(node.props.name.replace(ENTITY_REGEX, key => ESCAPE_ENTITIES[key]))}</code>`;
  },
  CodeLink: async ({ context, props, node }) => {
    const target = await context.resolveCodeLink(node);
    return `<a target="_blank" class="source-link" href="${context.link(target.file, target)}">${props.title}</a>`;
  },
  Anchor: async ({ context, props }) =>
    `<a class="anchor-link" routerLink="." fragment="${context.getAnchorId(props.href)}">${props.title}</a>`,

  File: state => Html.Ref(state),
  Ref: async ({ context, props }) =>
    `<a target="_blank" class="source-link" href="${context.link(props.href, props)}">${props.title}</a>`,
  Image: async ({ context, props }) => {
    if (!/^https?:/.test(props.href) && !(await fs.stat(props.href).catch(() => false))) {
      throw new Error(`${props.href} is not a valid location`);
    }
    return `<img src="${context.link(props.href, props)}" alt="${props.title}">`;
  },

  Module: async ({ context, props }) => {
    const config = MODULES[props.name];
    return `<a class="module-link" href="${context.link(config.folder, config)}" title="${config.description}">${config.displayName}</a>`;
  },
  Library: async ({ context, props }) => {
    const config = LIBRARIES[props.name];
    return `<a target="_blank" class="external-link" href="${context.link(config.href, config)}">${config.title}</a>`;
  },

  Note: async ({ recurse }) => `\n\n<p class="note"><strong>Note</strong> ${await recurse()}</p>\n`,
  Header: async ({ props }) => `<h1>${props.title} ${props.description ? `\n<small>${props.description}</small>\n` : ''}</h1>\n`,

  StdHeader: async state => {
    const module = state.node.props.module ?? Runtime.main.name;
    const pkg = PackageUtil.readPackage(RuntimeIndex.getModule(module)!.sourcePath);
    const title = pkg.travetto?.displayName ?? pkg.name;
    const desc = pkg.description;
    let install = '';
    if (state.node.props.install !== false) {
      const sub = state.createState('Install', {
        title: pkg.name,
        pkg: pkg.name,
      });
      install = await Html.Install(sub);
    }
    return `<h1>${title}${desc ? `\n<small>${desc}</small>\n` : ''}</h1>\n${install}\n`;
  }
};