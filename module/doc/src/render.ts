import { FsUtil } from '@travetto/boot';

import * as n from './nodes';
import { highlight } from './code-highlight';

const ROOT = FsUtil.resolveUnix(FsUtil.cwd, '..', '..');

type N = typeof n;
export type AllChildren = { [K in keyof N]: ReturnType<N[K]> }[keyof N];

type Anchor = ReturnType<N['Anchor']>;

export type Renderer = {
  render(child: AllChildren): string;
  wrap(content: string, module: string): string;
  toc(content: string, title: string, anchors: Anchor[]): string;
};

function titleCase(a: string) {
  return `${a.charAt(0).toUpperCase()}${a.substr(1)}`;
}


const TOKENS: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '{': `{{'{'}}`, '}': `{{'}'}}` };

function clean(a?: string) {
  return a ? a.replace(/^[\n ]+|[\n ]+$/gs, '') : '';
}

function getId(a: string) {
  return a.toLowerCase().replace(/[^a-z]+/g, '-');
}

export const Markdown: Renderer = {
  toc(content: string, title: string, anchors: Anchor[]) {
    const lines = content.split(/\n/g);
    const empty = lines.findIndex(x => x.startsWith('##'));
    lines.splice(empty - 1, 0, this.render(n.Group([n.SubSection(title), n.Ordered(...anchors)])), '');
    return lines.join('\n');
  },
  render(c: AllChildren) {
    const recurse = (s: any) => this.render(s);
    const link = (s: any, ctx?: any) =>
      `${this.render(s)
        .replace(ROOT, '%GIT%')
        .replace('@travetto/', `%GIT%/module/`)}${ctx.line ? `#L${ctx.line}` : ''}`;
    switch (c._type) {
      case 'group': return c.nodes.map(cc => recurse(cc,)).join('');
      case 'code':
      case 'install':
      case 'terminal':
      case 'config': return `
**${titleCase(c._type)}: ${recurse(c.title)}**
\`\`\`${c.language}
${clean(recurse(c.content))}
\`\`\`\n`;
      case 'anchor': return `[${recurse(c.title)}](#${getId(recurse(c.fragment))}})`;
      case 'library':
      case 'file':
      case 'ref': return `[${recurse(c.title)}](${link(c.link, c)})`;
      case 'mod': return `[${recurse(c.title)}](${link(c.link, c)}#readme "${recurse(c.description)}")`;
      case 'image': return `![${recurse(c.title)}](${link(c.link, c)})`;
      case 'section': return `## ${recurse(c.title)}`;
      case 'subsection': return `### ${recurse(c.title)}`;
      case 'command':
      case 'method':
      case 'path':
      case 'class':
      case 'field':
      case 'input': return `\`${clean(recurse(c.content))}\``;
      case 'note': return `**Note**: ${clean(recurse(c.content))}`;
      case 'item': return `${c.ordered ? '1.' : '* '} ${recurse(c.node)}`;
      case 'list': {
        const out: string[] = [''];
        for (const el of c.items) {
          out.push(...recurse(el).split(/\n/g));
        }
        for (let i = 0; i < out.length; i++) {
          out[i] = `   ${out[i]}`;
        }
        return out.join('\n');
      }
      case 'header':
        return `# ${recurse(c.title)}\n${c.description ? `## ${recurse(c.description)}\n` : ''}${'install' in c ? recurse(n.Install(c.package, c.package)) : ''}\n`;
      case 'text':
        return c.content;
      case 'hidden':
        return '';
    }
  },
  wrap: (x, module) => x.replace(new RegExp(`[.][.]/${module}`, 'g'), '.')
};

export const Html: Renderer = {
  toc(content: string, title: string, anchors: Anchor[]) {
    return `<div class="toc"><div class="inner">
  ${this.render(n.SubSection(n.Text(title)))}
  ${this.render(n.List(...anchors))}
</div></div>${content}`;
  },
  render(c: AllChildren) {
    const recurse = (s: any) => this.render(s);
    const link = (s: any, ctx?: any) =>
      `${this.render(s)
        .replace(/@travetto\/([^.]+)$/, (_, x) => `/docs/${x}`)
        .replace(ROOT, '%GIT%')
        .replace(/^images\//, '/assets/images/%MOD%/')
        .replace(/^https?:\/\/travetto.dev\//g, '/')
        .replace(/^.*@travetto\//, '%GIT%/module/')}${ctx && ctx.line ? `#L${ctx.line}` : ''}`;
    switch (c._type) {
      case 'group': return c.nodes.map(cc => recurse(cc)).join('');
      case 'install':
      case 'terminal':
      case 'config':
      case 'code': return `
      <figure class="${c._type}">
      <figcaption class="${c._type}">${recurse(c.title)}
      ${'file' in c && c.file ? `<cite><a target="_blank" href="${link(c.file, c)}">Source</a></cite>` : ''}
      </figcaption>
      <pre><code class="language-${c.language}">${clean(highlight(recurse(c.content), c.language))}</code></pre>     
      </figure>`;
      case 'anchor': return `<a class="anchor-link" routerLink="." fragment="${getId(recurse(c.fragment))}">${recurse(c.title)}</a>`;
      case 'library':
      case 'file':
      case 'ref': return `<a target="_blank" class="${c._type === 'library' ? 'external-link' : 'source-link'}" href="${link(c.link, c)}">${recurse(c.title)}</a>`;
      case 'mod': return `<a class="module-link" href="${link(c.link, c)}" title="${recurse(c.description)}">${recurse(c.title)}</a>`;
      case 'image': return `<img src="${link(c.link, c)}" alt="${recurse(c.title)}">`;
      case 'section':
      case 'subsection': {
        const tag = c._type === 'section' ? 'h2' : 'h3';
        const title = recurse(c.title);
        return `<${tag} id="${getId(title)}">${title}</${tag}>`;
      }
      case 'command':
      case 'method':
      case 'path':
      case 'class':
      case 'field':
      case 'input': return `<code class="item ${c._type}">${clean(recurse(c.content)).replace(/[<>{}]/mg, (k: string) => TOKENS[k])}</code>`;
      case 'note': return `<p class="note"><strong>Note</strong> ${recurse(c.content)}</p>`;
      case 'item': return ` <li>${recurse(c.node)}</li>`;
      case 'list': {
        const out: string[] = [];
        const ordered = c.items.find(x => x._type === 'item' && 'ordered' in x && x.ordered);

        for (const el of c.items) {
          out.push(recurse(el));
        }
        const tag = ordered ? 'ol' : 'ul';
        return `<${tag}>${out.join('\n')}</${tag}>`;
      }
      case 'header':
        return `<h1>${recurse(c.title)}
          ${c.description ? `<small>${recurse(c.description)}</small>\n` : ''}
        </h1>\n${'install' in c ? recurse(n.Install(`Install ${c.package}`, c.package)) : ''}\n`;
      case 'text':
        return c.content;
      case 'hidden':
        return '';
    }
  },
  wrap: (x, module) => `<div class="documentation">\n${x}\n</div>`
    .replace(/%MOD%/g, module)
};


export const Renderers = {
  md: Markdown,
  html: Html
};