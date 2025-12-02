import fs from 'node:fs/promises';

import { JSXElement } from '@travetto/doc/jsx-runtime';
import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { PackageUtil } from '@travetto/manifest';

import { highlight } from './code-highlight.ts';
import { RenderProvider, RenderState } from '../types.ts';
import { c, getComponentName } from '../jsx.ts';
import { MOD_MAPPING } from '../mapping/mod-mapping.ts';
import { LIB_MAPPING } from '../mapping/lib-mapping.ts';
import { RenderContext } from './context.ts';
import { DocResolveUtil } from '../util/resolve.ts';

const ESCAPE_ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '{': "{{'{'}}", '}': "{{'}'}}" };
const ENTITY_RE = new RegExp(`[${Object.keys(ESCAPE_ENTITIES).join('')}]`, 'gm');

const stdInline = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${el.type}>${await recurse()}</${el.type}>`;

const std = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${el.type}>${await recurse()}</${el.type}>\n`;

const stdFull = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `\n<${el.type}>${await recurse()}</${el.type}>\n`;

export const Html: RenderProvider<RenderContext> = {
  ext: 'html',
  finalize: (text, context) => {
    const brand = `<!-- ${context.generatedStamp} -->\n<!-- ${context.rebuildStamp} -->`;
    const cleaned = text
      .replace(/(<[/](?:a)>)([A-Za-z0-9$])/g, (_, tag, v) => `${tag} ${v}`)
      .replace(/(<[uo]l>)(<li>)/g, (_, a, b) => `${a} ${b}`);
    return `${brand}\n${cleaned}`;
  },
  br: async () => '<br><br>\n',
  hr: async () => '<hr>\n',
  strong: stdInline, em: stdInline,
  h2: stdFull, h3: stdFull, h4: stdFull,
  li: std, ol: stdFull, ul: stdFull,
  table: stdFull, thead: std, tr: std, td: std, tbody: std,
  Execution: async ({ context, el, props, createState }) => {
    const output = await context.execute(el);
    const displayCmd = props.config?.formatCommand?.(props.cmd, props.args ?? []) ??
      `${el.props.cmd} ${(el.props.args ?? []).join(' ')}`;
    const sub = createState('Terminal', {
      language: 'bash',
      title: props.title,
      src: [`$ ${displayCmd}`, '', context.cleanText(output)].join('\n')
    });
    return Html.Terminal(sub);
  },
  Install: async ({ context, el }) => {
    const highlighted = highlight(`
npm install ${el.props.pkg}

# or

yarn add ${el.props.pkg}
`, 'bash');

    return `\n
  <figure class="install">
    <figcaption class="install">Install ${el.props.title}
    
    </figcaption>
    <pre><code class="language-bash">${highlighted}</code></pre>
  </figure>\n\n
`;
  },
  Terminal: state => Html.Code(state),
  Config: state => Html.Code(state),
  Code: async ({ context, el, props }) => {
    DocResolveUtil.applyCodePropDefaults(el.props);

    const cls = getComponentName(el.type).replace(/^[A-Z]/g, v => v.toLowerCase());
    const content = await context.resolveCode(el);
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
      if (el.type === c.Terminal) {
        lang = 'bash';
      } else if (el.type === c.Code) {
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
  Input: async ({ el, context }) => {
    const cls = getComponentName(el.type).replace(/^[A-Z]/g, v => v.toLowerCase());
    return `<code class="item ${cls}">${context.cleanText(el.props.name.replace(ENTITY_RE, k => ESCAPE_ENTITIES[k]))}</code>`;
  },
  CodeLink: async ({ context, props, el }) => {
    const target = await context.resolveCodeLink(el);
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

  Mod: async ({ context, props }) => {
    const config = MOD_MAPPING[props.name];
    return `<a class="module-link" href="${context.link(config.folder, config)}" title="${config.description}">${config.displayName}</a>`;
  },
  Library: async ({ context, props }) => {
    const config = LIB_MAPPING[props.name];
    return `<a target="_blank" class="external-link" href="${context.link(config.href, config)}">${config.title}</a>`;
  },

  Note: async ({ recurse }) => `\n\n<p class="note"><strong>Note</strong> ${await recurse()}</p>\n`,
  Header: async ({ props }) => `<h1>${props.title} ${props.description ? `\n<small>${props.description}</small>\n` : ''}</h1>\n`,

  StdHeader: async state => {
    const mod = state.el.props.mod ?? Runtime.main.name;
    const pkg = PackageUtil.readPackage(RuntimeIndex.getModule(mod)!.sourcePath);
    const title = pkg.travetto?.displayName ?? pkg.name;
    const desc = pkg.description;
    let install = '';
    if (state.el.props.install !== false) {
      const sub = state.createState('Install', {
        title: pkg.name,
        pkg: pkg.name,
      });
      install = await Html.Install(sub);
    }
    return `<h1>${title}${desc ? `\n<small>${desc}</small>\n` : ''}</h1>\n${install}\n`;
  }
};