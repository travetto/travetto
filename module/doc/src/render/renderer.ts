import path from 'node:path';

import { type ManifestContext, PackageUtil } from '@travetto/manifest';
import { castTo, type Class, Runtime } from '@travetto/runtime';

import { EMPTY_ELEMENT, getComponentName, type JSXElementByFn, type c } from '../jsx.ts';
import type { DocumentShape, RenderProvider, RenderState } from '../types.ts';
import { DocFileUtil } from '../util/file.ts';

import { RenderContext } from './context.ts';
import { Html } from './html.ts';
import { Markdown } from './markdown.ts';

import { isJSXElement, type JSXElement, JSXFragmentType } from '../../support/jsx-runtime.ts';

const providers = { [Html.ext]: Html, [Markdown.ext]: Markdown };

/**
 * Doc Renderer
 */
export class DocRenderer {

  static async get(file: string, manifest: Pick<ManifestContext, 'workspace'>): Promise<DocRenderer> {
    const document = await Runtime.importFrom<DocumentShape>(file);
    const pkg = PackageUtil.readPackage(manifest.workspace.path);
    const repoBaseUrl = pkg.travetto?.doc?.baseUrl ?? manifest.workspace.path;
    return new DocRenderer(document,
      new RenderContext(file, repoBaseUrl, path.resolve(pkg.travetto?.doc?.root ?? manifest.workspace.path))
    );
  }

  #root: DocumentShape;
  #rootNode: JSXElement | JSXElement[];
  #support: RenderContext;

  constructor(root: DocumentShape, support: RenderContext) {
    this.#root = root;
    this.#support = support;
  }

  async #buildLink(
    renderer: RenderProvider<RenderContext>,
    cls: Class,
    title?: string
  ) {
    const source = DocFileUtil.readSource(cls);
    if (source) {
      title = DocFileUtil.isDecorator(cls.name, source.file) ? `@${title ?? cls.name}` : (title ?? cls.name);
      const node = this.#support.createElement('CodeLink', {
        src: source.file,
        startRe: new RegExp(`(class|function|interface)\\s+(${RegExp.escape(cls.name)})`),
        title
      });
      // @ts-expect-error
      const state: RenderState<JSXElementByFn<'CodeLink'>, RenderContext> = {
        node, props: node.props, recurse: async () => '', context: this.#support, stack: []
      };
      // @ts-expect-error
      state.createState = (key, props) => this.createState(state, key, props);
      return renderer.CodeLink(state);
    }
  }

  async #render(
    renderer: RenderProvider<RenderContext>,
    input: JSXElement[] | JSXElement | string | bigint | object | number | boolean | null | undefined,
    stack: JSXElement[] = []
  ): Promise<string | undefined> {

    if (input === null || input === undefined) {
      return '';
    } else if (Array.isArray(input)) {
      const out: string[] = [];
      for (const node of input) {
        const sub = await this.#render(renderer, node, stack);
        if (sub) {
          out.push(sub);
        }
      }
      return out.join('');
    } else if (isJSXElement(input)) {
      let final: JSXElement = input;
      // Render simple element if needed
      if (typeof input.type === 'function' && input.type !== JSXFragmentType) {
        const out = castTo<Function>(input.type)(input.props);
        final = out !== EMPTY_ELEMENT ? out : final;
      }

      if (final.type === JSXFragmentType) {
        return this.#render(renderer, final.props.children ?? []);
      }

      if (Array.isArray(final)) {
        return this.#render(renderer, final, stack);
      }

      const name = getComponentName(final.type);
      if (name in renderer) {
        const recurse = () => this.#render(renderer, final.props.children ?? [], [...stack, final]);
        // @ts-expect-error
        const state: RenderState<JSXElement, RenderContext> = {
          node: final, props: final.props, recurse, stack, context: this.#support
        };
        state.createState = (key, props) => this.createState(state, key, props);
        // @ts-expect-error
        return renderer[name](state);
      } else {
        console.log(final);
        throw new Error(`Unknown element: ${final.type}`);
      }
    } else {
      switch (typeof input) {
        case 'string': return input.replace(/&nbsp;/g, ' ');
        case 'number':
        case 'bigint':
        case 'boolean': return `${input}`;
        case 'object': {
          if (input) {
            return await this.#buildLink(renderer, castTo(input.constructor), input.constructor.name.replace(/^[$]/, ''));
          }
          break;
        }
        case 'function': {
          return await this.#buildLink(renderer, castTo(input));
        }
      }
      throw new Error(`Unknown object type: ${typeof input}`);
    }
  }

  createState<K extends keyof typeof c>(
    state: RenderState<JSXElement, RenderContext>,
    key: K,
    props: JSXElementByFn<K>['props']
    // @ts-expect-error
  ): RenderState<JSXElementByFn<K>, RenderContext> {
    const node = this.#support.createElement(key, props);
    return { ...state, node, props: node.props };
  }

  /**
   * Render a context given a specific renderer
   * @param renderer
   */
  async render(format: keyof typeof providers): Promise<string> {
    if (!providers[format]) {
      throw new Error(`Unknown renderer with format: ${format}`);
    }
    if (!this.#rootNode) {
      this.#rootNode = (Array.isArray(this.#root.text) || isJSXElement(this.#root.text)) ?
        this.#root.text : await (this.#root.text());
    }

    const text = await this.#render(providers[format], this.#rootNode);
    let cleaned = `${text?.replace(/\n{3,100}/msg, '\n\n').trim()}\n`;
    if (this.#root.wrap?.[format]) {
      cleaned = this.#root.wrap[format](cleaned);
    }
    return providers[format].finalize(cleaned, this.#support);
  }
}