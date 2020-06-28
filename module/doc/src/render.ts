import * as n from './nodes';

type N = typeof n;
type AllChildren = { [K in keyof N]: ReturnType<N[K]> }[keyof N];

type Renderer = {
  render(child: AllChildren, prefix?: string): string;
};

export const Markdown: Renderer = {
  render(c: AllChildren, prefix = '') {
    const recurse = (s: any, pre?: string) => this.render(s, pre);
    switch (c._type) {
      case 'group': return c.nodes.map(cc => recurse(cc)).join('');
      case 'code':
      case 'install':
      case 'terminal':
      case 'config':
      case 'snippet': return `
**${c._type.charAt(0).toUpperCase()}${c._type.substr(1)}: ${recurse(c.title)}**
\`\`\`${c.language}
${recurse(c.content)}
\`\`\``;
      case 'library':
      case 'file':
      case 'ref': return `[${recurse(c.title)}](${recurse(c.link)})`;
      case 'mod': return `[${recurse(c.title)}](${recurse(c.link)} "${recurse(c.description)}")`;
      case 'section': return `## ${recurse(c.title)}`;
      case 'subsection': return `### ${recurse(c.title)}`;
      case 'command':
      case 'method':
      case 'path':
      case 'input': return `\`${recurse(c.content)}\``;
      case 'note': return `**Note**: ${recurse(c.content).replace(/^\s+|\s+$/g, '')}`;
      case 'item': return ` ${c.ordered ? '1.' : '* '} ${recurse(c.node)}`;
      case 'list': {
        const out: string[] = [];
        for (const el of c.items) {
          out.push(...recurse(el, `${prefix}   `).split(/\n/g));
        }
        for (let i = 0; i < out.length; i++) {
          out[i] = `${prefix}${out[i]}`;
        }
        return out.join('\n');
      }
      case 'header':
        return `# ${recurse(c.title)}\n## ${recurse(c.description)}\n\n${recurse(n.Install(c.package))}`;
      case 'text':
        return c.content;
    }
  }
};

export function d(values: TemplateStringsArray, ...keys: (AllChildren | { ᚕfile: string, name: string } | string)[]) {
  const out: AllChildren[] = [];

  keys.forEach((el, i) =>
    out.push(
      n.Text(values[i] ?? ''),
      typeof el === 'string' ?
        n.Text(el) :
        'ᚕfile' in el ? n.Ref(el.name, el.ᚕfile) : el
    )
  );

  if (values.length > keys.length) {
    out.push(n.Text(values[values.length - 1]));
  }
  return out.length === 1 ? out[0] : n.Group(out);
}

export function inp(values: TemplateStringsArray) {
  return n.Input(n.Text(values[0]));
}

export function pth(values: TemplateStringsArray) {
  return n.Path(n.Text(values[0]));
}

export function meth(values: TemplateStringsArray) {
  return n.Method(n.Text(values[0]));
}
