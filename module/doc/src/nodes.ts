import { FsUtil } from '@travetto/boot';
import { DocUtil } from './util';

interface DocNode { _type: string }
type Content = DocNode | string;

export const Text = (text: string) => ({ _type: 'text' as const, content: text });
type TextType = ReturnType<typeof Text>;

function $c(val: string): TextType;
function $c(val: DocNode | string): DocNode;
function $c(val: DocNode | string | undefined): DocNode | undefined;
function $c(val: string | DocNode | undefined): DocNode | undefined {
  return val === undefined ? undefined : typeof val === 'string' ? Text(val) : val;
}
const $n = <T extends string, U extends Record<string, any>>(t: T, vals: U) => ({ _type: t, ...vals } as { _type: T } & U);

export const Group = (node: DocNode | DocNode[]) => $n('group', { nodes: [node].flat() });
export const Method = (content: Content) => $n('method', { content: $c(content) });
export const Command = (script: Content, ...args: Content[]) => $n('command', { content: [script, ...args] });
export const Terminal = (title: Content, script: string) => $n('terminal', { title: $c(title), content: $c(script), language: 'bash' });
export const Hidden = (content: Content) => $n('hidden', { content: $c(content) });
export const Input = (content: Content) => $n('input', { content: $c(content) });
export const Path = (content: Content) => $n('path', { content: $c(content) });
export const Class = (content: Content) => $n('class', { content: $c(content) });
export const Field = (content: Content) => $n('field', { content: $c(content) });
export const Section = (title: Content) => $n('section', { title: $c(title) });
export const SubSection = (title: Content) => $n('subsection', { title: $c(title) });
export const Library = (title: Content, link: Content) => $n('library', { title: $c(title), link: $c(link) });
export const Anchor = (title: Content, fragment: Content) => $n('anchor', { title: $c(title), fragment: $c(fragment) });
export const Note = (content: Content) => $n('note', { content: $c(content) });
export const Item = (node: DocNode, ordered = false) => $n('item', { node, ordered });
export const RawHeader = (title: Content, description?: string) => $n('header', { title: $c(title), description: $c(description) });

export function SnippetLink(title: Content, file: string, startPattern: RegExp) {
  const res = DocUtil.resolveSnippetLink(file, startPattern);
  return $n('file', { title: $c(title), link: $c(res.file), line: res.line });
}

export function Execute(title: Content, cmd: string, args: string[] = [], cwd = FsUtil.cwd) {
  const script = DocUtil.run(cmd, args, { cwd });
  return Terminal(title, `$ ${cmd} ${args.join(' ')}\n\n${script}`);
}

export function Mod(name: string) {
  const config = DocUtil.PACKAGES.get(name);
  if (!config) {
    throw new Error(`Module ${name} is unknown`);
  }
  return $n('mod', { title: $c(config.title), link: $c(`@travetto/${name}`), description: $c(config.description) });
}

export function Ref(title: Content, file: string) {
  const res = DocUtil.resolveRef(title, file);
  return $n('ref', { title: $c(res.title), link: $c(res.file), line: res.line });
}

export function Code(title: Content, content: Content, outline = false, language = 'typescript') {
  const res = DocUtil.resolveCode(content, language, outline);
  return $n('code', { title: $c(title), content: $c(res.content), language: res.language, file: $c(res.file) });
}

export function Config(title: Content, content: Content, language = 'yaml') {
  const res = DocUtil.resolveConfig(content, language);
  return $n('config', { title: $c(title), content: $c(res.content), language: res.language, file: $c(res.file) });
}

export function Header(folder: string, install = true) {
  const pkg = require(`${folder}/package.json`) as Record<string, string>;
  return $n('header', { title: $c(pkg.title), description: $c(pkg.description), package: pkg.name, install });
}

export function Snippet(title: Content, file: string, startPattern: RegExp, endPattern?: RegExp, outline?: boolean) {
  const res = DocUtil.resolveSnippet(file, startPattern, endPattern, outline);
  return $n('code', { title: $c(title), content: $c(res.text), line: res.line, file: $c(res.file), language: res.language });
}

export function Install(title: Content, pkg: Content) {
  pkg = typeof pkg === 'string' && !pkg.includes(' ') ? `npm install ${pkg}` : pkg;
  return $n('install', { title: $c(title), language: 'bash', content: $c(pkg) });
}

function BuildList(items: Content[], ordered = false) {
  return $n('list', {
    items: items.map(x => {
      if (Array.isArray(x)) {
        x = Item(Group(x), ordered);
      } else if (typeof x === 'string') {
        x = $c(x);
      }
      switch (x._type) {
        case 'list': return x;
        case 'item': return { ...x, ordered };
        default: return Item(x, ordered);
      }
    })
  });
}

export const List = (...items: Content[]) => BuildList(items);
export const Ordered = (...items: Content[]) => BuildList(items, true);

export function Image(title: Content, file: string) {
  if (!/^https?:/.test(file) && !FsUtil.existsSync(file)) {
    throw new Error(`${file} is not a valid location`);
  }

  return $n('image', { title: $c(title), link: $c(file) });
}