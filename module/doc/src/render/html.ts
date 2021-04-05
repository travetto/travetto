import { node as n } from '../nodes';
import { AllChildren, RenderContext } from './context';
import { highlight } from './code-highlight';
import { DocNode, Renderer } from '../types';

const ESCAPE_ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '{': "{{'{'}}", '}': "{{'}'}}" };
const ENTITY_RE = new RegExp(`[${Object.keys(ESCAPE_ENTITIES).join('')}]`, 'gm');

export const Html: Renderer = {
  ext: 'html',
  render(c: AllChildren, context: RenderContext, root = c) {
    const recurse = (s: AllChildren | DocNode) => this.render(s as AllChildren, context, root);
    switch (c._type) {
      case 'toc': {
        const content = recurse(n.Group([n.SubSection(c.title), context.toc(root)]));
        return `<div class="toc"><div class="inner">${content}</div></div>`;
      }
      case 'strong': return `<strong>${recurse(c.content)}</strong>`;
      case 'group': return c.nodes.map(cc => recurse(cc)).join('');
      case 'comment': return `<!-- ${recurse(c.text)} -->`;
      case 'install':
      case 'terminal':
      case 'config':
      case 'code': return `
      <figure class="${c._type}">
      <figcaption class="${c._type}">${recurse(c.title)}
      ${'file' in c && c.file ? `<cite><a target="_blank" href="${context.link(recurse(c.file), c)}">Source</a></cite>` : ''}
      </figcaption>
      <pre><code class="language-${c.language}">${context.cleanText(highlight(recurse(c.content), c.language))}</code></pre>     
      </figure>`;
      case 'anchor': return `<a class="anchor-link" routerLink="." fragment="${context.getAnchorId(recurse(c.fragment))}">${recurse(c.title)}</a>`;
      case 'library':
      case 'file':
      case 'ref': return `<a target="_blank" class="${c._type === 'library' ? 'external-link' : 'source-link'}" href="${context.link(recurse(c.link), c)}">${recurse(c.title)}</a>`;
      case 'mod': return `<a class="module-link" href="${context.link(recurse(c.link), c)}" title="${recurse(c.description)}">${recurse(c.title)}</a>`;
      case 'image': return `<img src="${context.link(recurse(c.link), c)}" alt="${recurse(c.title)}">`;
      case 'section':
      case 'subsection': {
        const tag = c._type === 'section' ? 'h2' : 'h3';
        const title = recurse(c.title);
        return `<${tag} id="${context.getAnchorId(title)}">${title}</${tag}>`;
      }
      case 'command':
      case 'method':
      case 'path':
      case 'class':
      case 'field':
      case 'input': return `<code class="item ${c._type}">${context.cleanText(recurse(c.content)).replace(ENTITY_RE, k => ESCAPE_ENTITIES[k])}</code>`;
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
    }
  }
};
