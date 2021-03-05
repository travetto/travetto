import { FsUtil } from '@travetto/boot';
import * as n from '../nodes';

import { AllChildren, AnchorType, Renderer } from './types';
import { RenderUtil } from './util';

const { getId, clean, titleCase } = RenderUtil;

const ROOT = FsUtil.resolveUnix('..', '..');

export const Markdown: Renderer = {
  ext: 'md',
  toc(title: string, anchors: AnchorType[]) {
    return this.render(n.Group([n.SubSection(title), n.Ordered(...anchors)]));
  },
  render(c: AllChildren) {
    const recurse = (s: AllChildren | n.DocNode) => this.render(s as AllChildren);
    const link = (s: n.DocNode, ctx: { _type: string, line?: number }) =>
      `${recurse(s)
        .replace(ROOT, '%GIT%')
        .replace('@travetto/', '%GIT%/module/')}${ctx.line ? `#L${ctx.line}` : ''}`;
    switch (c._type) {
      case 'strong': return `**${recurse(c.content)}**`;
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
      case 'table': {
        const header = ['', ...c.headers.map(h => recurse(h)), ''].join('|');
        const out: string[] = [
          header,
          header.replace(/[^|]/g, '-'),
          ...c.rows.map(row => ['', ...row.map(r => recurse(r)), ''].join('|'))
        ];
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
  finalize: ({ preamble, toc, header, content, module }) =>
    `${preamble}\n${header}\n${toc}\n${content}`
      .replace(new RegExp(`[.][.]/${module}`, 'g'), '.')
};
