import { createElement, JSXElement, JSXComponentFunction as CompFn } from '@travetto/doc/jsx-runtime';
import { TypedObject } from '@travetto/base';

import { LIB_MAPPING } from './mapping/lib-mapping';
import { MOD_MAPPING } from './mapping/mod-mapping';
import { RunConfig } from './util/run';

type CodeProps = { title: string, src: string | Function, language?: string, outline?: boolean, startRe?: RegExp, endRe?: RegExp };
type InstallProps = { title: string, pkg: string };
type ExecProps = { title: string, cmd: string, args?: string[], config?: RunConfig & { formatCommand?(cmd: string, args: string[]): string } };
type StdHeaderProps = { mod?: string, install?: boolean };
type HeaderProps = { title: string, description?: string };
type ModProps = { name: keyof typeof MOD_MAPPING };
type LibraryProps = { name: keyof typeof LIB_MAPPING };
type LinkProps = { title: string, href: string, line?: number };
type CodeLinkProps = { title: string, src: string | Function, startRe: RegExp };
type Named = { name: string };
type Titled = { title: string };

const EMPTY: JSXElement = { type: '', key: '', props: {} };

const Input: CompFn<Named> = () => EMPTY; // Input text
const Field: CompFn<Named> = () => EMPTY; // Field reference
const Method: CompFn<Named> = () => EMPTY; // Method declaration
const Command: CompFn<Named> = () => EMPTY; // Command invocation
const Path: CompFn<Named> = () => EMPTY; // Path reference
const Class: CompFn<Named> = () => EMPTY; // Class reference

const CodeLink: CompFn<CodeLinkProps> = () => EMPTY; // Code link with regexp for detecting line
const Anchor: CompFn<LinkProps> = () => EMPTY; // In page anchor reference
const Ref: CompFn<LinkProps> = () => EMPTY; // File reference
const File: CompFn<LinkProps> = () => EMPTY; // File reference
const Image: CompFn<LinkProps> = () => EMPTY; // Image reference

const Note: CompFn = () => EMPTY; // A note
const Section: CompFn<Titled> = () => EMPTY; // Primary section
const SubSection: CompFn<Titled> = () => EMPTY; // Sub-section
const SubSubSection: CompFn<Titled> = () => EMPTY; // Sub-sub-section

const Code: CompFn<CodeProps> = () => EMPTY; // Code sample
const Terminal: CompFn<CodeProps> = () => EMPTY; // Terminal output
const Install: CompFn<InstallProps> = () => EMPTY; // Installing a package or a program
const Config: CompFn<CodeProps> = () => EMPTY; // Configuration block

const StdHeader: CompFn<StdHeaderProps> = () => EMPTY; // Standard module header
const Header: CompFn<HeaderProps> = () => EMPTY; // Basic module header
const Execution: CompFn<ExecProps> = () => EMPTY; // Run a command, and include the output as part of the document

const Mod: CompFn<ModProps> = () => EMPTY; // Node Module Reference
const Library: CompFn<LibraryProps> = () => EMPTY; // Library reference

export const c = {
  Input, Field, Method, Command, Path, Class,
  Anchor, Library, Ref, File, Image, CodeLink,
  Mod, Note, Header, StdHeader,
  Section, SubSection, SubSubSection,
  Code, Execution, Terminal, Install, Config
} as const;

type C = typeof c;

// @ts-expect-error
export type JSXElementByFn<K extends keyof C> = JSXElement<C[K], Parameters<C[K]>[0]>;
export type JSXElements = { [K in keyof C]: JSXElementByFn<K>; };

export const EMPTY_ELEMENT = EMPTY;

const invertedC = new Map<Function, string>(TypedObject.entries(c).map(p => [p[1], p[0]] as [CompFn, string]));

export function getComponentName(fn: Function | string): string {
  if (typeof fn === 'string') {
    return fn;
  }
  return invertedC.get(fn) ?? fn.name;
}

function CodeLinker(node: JSXElement): JSXElementByFn<'CodeLink'>;
function CodeLinker(title: string, src: string, startRe: RegExp): JSXElementByFn<'CodeLink'>;
function CodeLinker(titleOrNode: string | JSXElement, src?: string, startRe?: RegExp): JSXElementByFn<'CodeLink'> {
  let props: CodeLinkProps;
  if (typeof titleOrNode === 'string') {
    props = { title: titleOrNode, src: src!, startRe: startRe! };
  } else if (titleOrNode.type === Code) {
    const node = titleOrNode as unknown as JSXElementByFn<'Code'>;
    props = {
      title: node.props.title,
      src: node.props.src,
      startRe: node.props.startRe!
    };
  } else {
    throw new Error(`Unsupported element type: ${titleOrNode.type}`);
  }
  return createElement(c.CodeLink, props) as JSXElementByFn<'CodeLink'>;
}

export const d = {
  ref: (title: string, src: string) => createElement(c.Ref, { title, href: src }),
  codeLink: CodeLinker,
  input: (name: string) => createElement(c.Input, { name }),
  method: (name: string) => createElement(c.Method, { name }),
  class: (name: string) => createElement(c.Class, { name }),
  path: (name: string) => createElement(c.Path, { name }),
  command: (name: string) => createElement(c.Command, { name }),
  field: (name: string) => createElement(c.Field, { name }),
  library: (name: keyof typeof LIB_MAPPING) => createElement(c.Library, { name }),
  mod: (name: keyof typeof MOD_MAPPING) => createElement(c.Mod, { name }),
};