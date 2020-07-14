import { FsUtil } from '@travetto/boot';
import { DocUtil } from './util';

interface DocNode {
  _type: string;
}

type Content = DocNode | string;

export function Text(text: string) {
  return { _type: 'text' as const, content: text };
}

export function Group(node: DocNode | DocNode[]) {
  return { _type: 'group' as const, nodes: [node].flat() };
}

export function Mod(name: string) {
  if (!(DocUtil.PACKAGES.has(name))) {
    throw new Error(`Module ${name} is unknown`);
  }
  const config = DocUtil.PACKAGES.get(name)!;
  return { _type: 'mod' as const, title: Text(config.title), link: Text(`@travetto/${name}`), description: Text(config.description) };
}

export function Ref(title: Content, file: string) {
  // Ensure it is valid
  let line = 0;
  if (file.startsWith('@')) {
    file = require.resolve(file);
  } else if (/^([.][/]|src|alt)/.test(file)) {
    if (!file.startsWith('.')) {
      file = `./${file}`;
    }
    file = FsUtil.resolveUnix(file);
  }
  if (!FsUtil.existsSync(file)) {
    throw new Error(`${file} is not a valid location`);
  } else {
    const res = DocUtil.read(file);
    file = res.file;
    if (typeof title == 'string') {
      if (res.content) {
        line = res.content.split(/\n/g)
          .findIndex(x => new RegExp(`(class|function)[ ]+${title}`).test(x));
        if (line < 0) {
          line = 0;
        } else {
          line += 1;
        }
        if (DocUtil.isDecorator(title, file)) {
          title = `@${title}`;
        }
      }
      title = Text(title);
    }
  }
  const ret = { _type: 'ref' as const, title, link: Text(file), line };
  return ret;
}

export function Method(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'method' as const, content };
}

export function Code(title: Content, content: Content, outline = false, language?: string) {
  let file: string | undefined;
  if (typeof content === 'string') {
    if (/^[@:A-Za-z0-9\/\\\-_.]+[.]([a-z]{2,4})$/.test(content)) {
      const res = DocUtil.read(content);
      language = res.language;
      file = res.file;
      content = res.content;
      content = DocUtil.cleanCode(content, outline);
    }
    content = Text(content.replace(/^\/\/# sourceMap.*$/gm, ''));
  }
  if (typeof title === 'string') {
    title = Text(title);
  }

  language = language ?? 'typescript';

  return { _type: 'code' as const, title, content, language, file: file ? Text(file) : file };
}

export function Config(title: Content, content: Content, language = 'yaml') {
  let file: string | undefined;
  if (typeof title === 'string') {
    title = Text(title);
  }
  if (typeof content === 'string') {
    if (/^[@:A-Za-z0-9\/\\\-_.]+[.](ya?ml|properties)$/.test(content)) {
      const res = DocUtil.read(content);
      language = res.language;
      file = res.file;
      content = res.content;
    }
    content = Text(content);
  }

  return { _type: 'config' as const, title, content, language, file: file ? Text(file) : file };
}

export function Snippet(title: Content, file: string, startPattern: RegExp, endPattern?: RegExp, outline?: boolean, language = 'typescript') {
  const res = DocUtil.read(file);
  language = res.language;
  file = res.file;
  const content = res.content.split(/\n/g);
  const startIdx = content.findIndex(l => startPattern.test(l));
  const endIdx = endPattern ? content.findIndex((l, i) => i > startIdx && endPattern.test(l)) : startIdx;
  let text = content.slice(startIdx, endIdx + 1).join('\n');

  if (outline) {
    text = DocUtil.cleanCode(text, outline);
  }

  if (typeof title === 'string') {
    title = Text(title);
  }

  return {
    _type: 'code' as const,
    title,
    content: Text(text),
    line: startIdx + 1,
    file: Text(file),
    language
  };
}

export function SnippetLink(title: Content, file: string, startPattern: RegExp) {
  const content = DocUtil.read(file).content.split(/\n/);
  const startIdx = content.findIndex(l => startPattern.test(l));
  if (typeof title === 'string') {
    title = Text(title);
  }
  return { _type: 'file' as const, title, link: Text(file), line: startIdx };
}

export function Command(script: Content, ...args: Content[]) {
  return { _type: 'command' as const, content: [script, ...args] };
}

export function Terminal(title: Content, script: string) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  return { _type: 'terminal' as const, title, content: Text(script), language: 'bash' };
}

export function Execute(title: Content, cmd: string, args: string[] = [], cwd = FsUtil.cwd) {
  const script = DocUtil.run(cmd, args, { cwd });
  return Terminal(title, `$ ${cmd} ${args.join(' ')}\n\n${script}`);
}

export function Hidden(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'hidden' as const, content };
}

export function Input(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'input' as const, content };
}

export function Path(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'path' as const, content };
}

export function Class(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'class' as const, content };
}

export function Field(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'field' as const, content };
}

export function Section(title: Content) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  return { _type: 'section' as const, title };
}

export function SubSection(title: Content) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  return { _type: 'subsection' as const, title };
}

export function Install(title: Content, pkg: Content) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  if (typeof pkg === 'string') {
    if (!pkg.includes(' ')) {
      pkg = Text(`npm install ${pkg}`);
    } else {
      pkg = Text(pkg);
    }
  }
  return {
    _type: 'install' as const,
    title,
    language: 'bash',
    content: pkg
  };
}

export function Library(title: Content, link: Content) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  if (typeof link === 'string') {
    link = Text(link);
  }
  return { _type: 'library' as const, title, link };
}

export function Anchor(title: Content, fragment: Content) {
  if (typeof title === 'string') {
    title = Text(title);
  }
  if (typeof fragment === 'string') {
    fragment = Text(fragment);
  }
  return { _type: 'anchor' as const, title, fragment };
}

export function Note(content: Content) {
  if (typeof content === 'string') {
    content = Text(content);
  }
  return { _type: 'note' as const, content };
}

export function Item(node: DocNode, ordered = false) {
  return { _type: 'item' as const, node, ordered };
}

function BuildList(items: Content[], ordered = false) {
  return {
    _type: 'list' as const,
    items: items.map(x => {
      if (Array.isArray(x)) {
        x = Item(Group(x), ordered);
      } else if (typeof x === 'string') {
        x = Text(x);
      }
      switch (x._type) {
        case 'list': return x;
        case 'item': return { ...x, ordered };
        default: return Item(x, ordered);
      }
    })
  };
}

export function List(...items: Content[]) {
  return BuildList(items);
}

export function Ordered(...items: Content[]) {
  return BuildList(items, true);
}

export function Header(folder: string, install = true) {
  const pkg = require(`${folder}/package.json`);
  return {
    _type: 'header' as const,
    title: Text(pkg.title as string),
    description: Text(pkg.description as string),
    package: pkg.name as string,
    install
  };
}

export function RawHeader(title: Content, description?: string) {
  return {
    _type: 'header' as const,
    title: typeof title === 'string' ? Text(title) : title,
    description: description ? Text(description) : undefined
  };
}

export function Image(title: Content, file: string) {
  if (!/^https?:/.test(file) && !FsUtil.existsSync(file)) {
    throw new Error(`${file} is not a valid location`);
  }

  return {
    _type: 'image' as const,
    title: typeof title === 'string' ? Text(title) : title,
    link: Text(file)
  };
}