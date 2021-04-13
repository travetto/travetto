import { AllType, node as n } from '../nodes';
import { DocNode, Renderer } from '../types';
import { AllChildren, RenderContext } from './context';

const titleCase = (a: string) => a.replace(/^[a-z]/, v => v.toUpperCase());

export const Markdown: Renderer = {
  ext: 'md',
  render(c: AllChildren, context: RenderContext, root: AllType = c) {
    const recurse = (s: AllChildren | DocNode) => this.render(s as AllChildren, context, root);
    switch (c._type) {
      case 'toc': return recurse(n.Group([n.SubSection(c.title), context.toc(root)]));
      case 'strong': return `**${recurse(c.content)}**`;
      case 'group': return c.nodes.map(cc => recurse(cc,)).join('');
      case 'comment': return `<!-- ${recurse(c.text)} -->`;
      case 'code':
      case 'install':
      case 'terminal':
      case 'config': return `
**${titleCase(c._type)}: ${recurse(c.title)}**
\`\`\`${c.language}
${context.cleanText(recurse(c.content))}
\`\`\`\n`;
      case 'anchor': return `[${recurse(c.title)}](#${context.getAnchorId(recurse(c.fragment))}})`;
      case 'library':
      case 'file':
      case 'ref': return `[${recurse(c.title)}](${context.link(recurse(c.link), c)})`;
      case 'mod': return `[${recurse(c.title)}](${context.link(recurse(c.link), c)}#readme "${recurse(c.description)}")`;
      case 'image': return `![${recurse(c.title)}](${context.link(recurse(c.link), c)})`;
      case 'section': return `## ${recurse(c.title)}`;
      case 'subsection': return `### ${recurse(c.title)}`;
      case 'command':
      case 'method':
      case 'path':
      case 'class':
      case 'field':
      case 'input': return `\`${context.cleanText(recurse(c.content))}\``;
      case 'note': return `**Note**: ${context.cleanText(recurse(c.content))}`;
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
    }
  }
};
