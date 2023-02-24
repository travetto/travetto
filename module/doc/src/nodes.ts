import { existsSync } from 'fs';

import { path, RootIndex, PackageUtil } from '@travetto/manifest';

import { FileUtil, } from './util/file';
import { DocRunUtil, RunConfig } from './util/run';
import { Content, DocNode, TextType } from './types';
import { ResolveUtil } from './util/resolve';

function $c(val: string): TextType;
function $c(val: DocNode | string): DocNode;
function $c(val: DocNode | string | undefined): DocNode | undefined;
function $c(val: string | DocNode | undefined): DocNode | undefined {
  return val === undefined ? undefined : typeof val === 'string' ?
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { _type: 'text' as const, content: val } as TextType : val;
}
const $n = <T extends string, U extends Record<string, unknown>>(t: T, values: U): { _type: T } & U =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ({ _type: t, ...values } as { _type: T } & U);

type FormattedCommand = { formatCommand?(cmd: string, args: string[]): string };

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/**
 * All Node Types
 */
export const node = {
  buildList(items: Content[], ordered = false) {
    return $n('list', {
      items: items.map(x => {
        if (Array.isArray(x)) {
          x = node.Item(node.Group(x), ordered);
        } else if (typeof x === 'string') {
          x = $c(x);
        }
        switch (x._type) {
          case 'list': return x;
          case 'item': return { ...x, ordered };
          default: return node.Item(x, ordered);
        }
      })
    });
  },

  /**
   * Simple Text Content
   * @param text
   */
  Text: (text: string) => ({ _type: 'text' as const, content: text }),

  /**
   * Strong Content
   * @param content
   */
  Strong: (content: Content) => $n('strong', { content: $c(content) }),
  /**
   * Group of content nodes
   * @param items
   */
  Group: (items: DocNode | DocNode[]) => $n('group', { nodes: [items].flat() }),
  /**
   * Method declaration
   * @param content
   */
  Method: (content: Content) => $n('method', { content: $c(content) }),
  /**
   * Command invocation
   * @param script
   * @param args
   */
  Command: (script: Content, ...args: Content[]) => $n('command', { content: $c([script, ...args].join(' ')) }),
  /**
   * Terminal output
   * @param title
   * @param script
   */
  Terminal: (title: Content, script: Content) => $n('terminal', { title: $c(title), content: $c(script), language: 'bash' }),
  /**
   * Input text
   * @param content
   */
  Input: (content: Content) => $n('input', { content: $c(content) }),
  /**
   * Path reference
   * @param content
   */
  Path: (content: Content) => $n('path', { content: $c(content) }),
  /**
   * Class reference
   * @param content
   */
  Class: (content: Content) => $n('class', { content: $c(content) }),
  /**
   * Field reference
   * @param content
   */
  Field: (content: Content) => $n('field', { content: $c(content) }),
  /**
   * Primary Section
   * @param content
   */
  Section: (title: Content) => $n('section', { title: $c(title) }),
  /**
   * Sub-section
   * @param content
   */
  SubSection: (title: Content) => $n('subsection', { title: $c(title) }),
  /**
   * Sub-sub-section
   * @param content
   */
  SubSubSection: (title: Content) => $n('subsubsection', { title: $c(title) }),
  /**
   * Library reference
   * @param content
   */
  Library: (title: Content, link: Content) => $n('library', { title: $c(title), link: $c(link) }),
  /**
   * In page anchor reference
   * @param title
   * @param fragment
   */
  Anchor: (title: Content, fragment: Content) => $n('anchor', { title: $c(title), fragment: $c(fragment) }),
  /**
   * A note
   * @param content
   */
  Note: (content: Content) => $n('note', { content: $c(content) }),
  /**
   * List item
   * @param item
   * @param ordered
   */
  Item: (item: DocNode, ordered = false) => $n('item', { node: item, ordered }),
  /**
   * Raw Doc Header
   * @param title
   * @param description
   */
  RawHeader: (title: Content, description?: string) => $n('header', { title: $c(title), description: $c(description) }),
  /**
   * Table Of Contents
   * @param title
   */
  TableOfContents: (title: Content) => $n('toc', { title: $c(title) }),

  /**
   * Link to a snippet of code, including line number
   * @param title
   * @param file
   * @param startPattern
   */
  SnippetLink: (title: Content, file: string, startPattern: RegExp) => {
    const res = ResolveUtil.resolveSnippetLink(file, startPattern);
    return $n('file', { title: $c(title), link: $c(res.file), line: res.line });
  },

  /**
   * Run a command, and include the output as part of the document
   * @param title
   * @param cmd
   * @param args
   * @param cfg
   */
  Execute: (title: Content, cmd: string, args: string[] = [], cfg: RunConfig & FormattedCommand = {}) => {
    if (cmd !== 'trv') {
      cmd = FileUtil.resolveFile(cmd).replace(path.cwd(), '.');
    }

    const script = DocRunUtil.run(cmd, args, cfg);
    const prefix = !/.*\/doc\/.*[.]ts$/.test(cmd) ? '$' : '$ node ';

    const commandDisplay = cfg.formatCommand?.(cmd, args) ?? `${cmd} ${args.join(' ')}`;

    return node.Terminal(title, `${prefix} ${commandDisplay}\n\n${script}`);
  },

  /**
   * Node Module Reference
   * @param name
   */
  Mod(name: string, cfg?: { folder: string, displayName: string, description: string }) {
    if (!cfg) {
      const folder = RootIndex.getModule(name)!.sourcePath;
      const pkg = PackageUtil.readPackage(folder);
      cfg = {
        folder,
        displayName: pkg.travetto!.displayName!,
        description: pkg.description!
      };
    }
    return $n('mod', { title: $c(cfg.displayName), link: $c(cfg.folder), description: $c(cfg.description), name: $c(name) });
  },

  /**
   * File reference
   * @param title
   * @param file
   */
  Ref: (title: Content, file: string | Function) => {
    if (typeof file === 'function') {
      file = RootIndex.getFunctionMetadata(file)!.source;
    }
    const res = ResolveUtil.resolveRef(title, file);
    return $n('ref', { title: $c(res.title), link: $c(res.file), line: res.line });
  },

  /**
   * Code sample
   * @param title
   * @param content
   * @param outline
   * @param language
   */
  Code: (title: Content, content: Content | Function, outline = false, language = 'typescript') => {
    if (typeof content === 'function') {
      content = RootIndex.getFunctionMetadata(content)!.source;
    }
    const res = ResolveUtil.resolveCode(content, language, outline);
    return $n('code', { title: $c(title), content: $c(res.content), language: res.language, file: $c(res.file) });
  },

  /**
   * Configuration Block
   * @param title
   * @param content
   * @param language
   */
  Config: (title: Content, content: Content, language = 'yaml') => {
    const res = ResolveUtil.resolveConfig(content, language);
    return $n('config', { title: $c(title), content: $c(res.content), language: res.language, file: $c(res.file) });
  },

  /**
   * Standard header
   * @param install
   * @param pkg
   */
  Header: (mod?: string, install = true) => {
    if (!mod) {
      mod = RootIndex.mainPackage.name;
    }
    const pkg = PackageUtil.readPackage(RootIndex.getModule(mod)!.sourcePath);
    return $n('header', { title: $c(pkg.travetto?.displayName ?? pkg.name), description: $c(pkg.description), package: pkg.name, install });
  },

  /**
   * Comment
   * @param text
   * @returns
   */
  Comment: (text: string) => $n('comment', { text: $c(text) }),

  /**
   * Code Snippet
   * @param title
   * @param file
   * @param startPattern
   * @param endPattern
   * @param outline
   */
  Snippet: (title: Content, file: string | Function, startPattern: RegExp, endPattern?: RegExp, outline?: boolean) => {
    if (typeof file !== 'string') {
      file = RootIndex.getFunctionMetadata(file)!.source;
    }
    const res = ResolveUtil.resolveSnippet(file, startPattern, endPattern, outline);
    return $n('code', {
      title: $c(title), content: $c(res.text), line: res.line, file: $c(res.file), language: res.language,
      link: node.SnippetLink(title, file, startPattern)
    });
  },

  /**
   * Installing a package or program
   * @param title
   * @param pkg
   */
  Install: (title: Content, pkg: Content) => {
    if (typeof pkg === 'string' && !pkg.includes(' ')) {
      return $n('install', {
        title: $c(title), language: 'bash', content: $c(`npm install ${pkg}\n\n# or\n\nyarn add ${pkg}`)
      });
    } else {
      return $n('install', { title: $c(title), language: 'bash', content: $c(pkg), subtype: undefined });
    }
  },

  /**
   * Standard List
   * @param items
   */
  List: (...items: Content[]) => node.buildList(items),

  /**
   * Ordered List
   * @param items
   */
  Ordered: (...items: Content[]) => node.buildList(items, true),

  /**
   * Table
   * @param headers
   * @param rows
   */
  Table: (headers: Content[], ...rows: Content[][]) =>
    $n('table', {
      headers: headers.map(x => typeof x === 'string' ? $c(x) : x),
      rows: rows.map(row =>
        row.map(x => typeof x === 'string' ? $c(x) : x)
      )
    }),

  /**
   * Image reference
   * @param title
   * @param file
   */
  Image: (title: Content, file: string) => {
    if (!/^https?:/.test(file) && !existsSync(file)) {
      throw new Error(`${file} is not a valid location`);
    }
    return $n('image', { title: $c(title), link: $c(file) });
  }
};

type NodeType = typeof node;

export type AllTypeMap = { [K in keyof NodeType]: ReturnType<NodeType[K]> };
export type AllType = ReturnType<(NodeType)[keyof NodeType]>;
