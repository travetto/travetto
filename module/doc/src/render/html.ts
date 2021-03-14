import { PathUtil } from '@travetto/boot';

import * as n from '../nodes';
import { AllChildren, RenderContext, Renderer } from './types';
import { RenderUtil } from './util';
import { highlight } from './code-highlight';

const { getId, clean, TOKENS } = RenderUtil;

const ROOT = PathUtil.resolveUnix('..', '..');

export const Html: Renderer = {
  ext: 'html',
  render(c: AllChildren, context: RenderContext) {
    const recurse = (s: AllChildren | n.DocNode) => this.render(s as AllChildren, context);
    const link = (s: n.DocNode, ctx: { _type: string, line?: number }) =>
      `${recurse(s)
        .replace(/@travetto\/([^.]+)$/, (_, x) => `/docs/${x}`)
        .replace(ROOT, context.gitRoot)
        .replace(/^images\//, `/assets/images/${context.module}/`)
        .replace(/^https?:\/\/travetto.dev\//g, '/')
        .replace(/^.*@travetto\//, `${context.gitRoot}/module/`)}${ctx && ctx.line ? `#L${ctx.line}` : ''}`;
    switch (c._type) {
      case 'future': return recurse(c.content());
      case 'toc': {
        const content = recurse(n.Group([n.SubSection(c.title), context.toc]));
        return `<div class="toc"><div class="inner">${content}</div></div>`;
      }
      case 'strong': return `<strong>${recurse(c.content)}</strong>`;
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
        return `<${tag} id="${getId(title.replace(/<[^>]+>/g, ' '))}">${title}</${tag}>`;
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
      case 'table': {
        const out: string[] = [
          '<table>', '<thead>',
          `<tr>${c.headers.map(h => recurse(h)).map(h => `<th>${h}</th>`).join('')}</tr>`,
          '</thead>', '<tbody>',
          ...c.rows.map(row => `<tr>${row.map(r => `<td>${recurse(r)}</td>`).join('')}</tr>`),
          '</tbody>', '</table>'
        ];
        return out.join('\n');
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
  assemble: content => `<div class="documentation">\n${content}\n</div>`
};
