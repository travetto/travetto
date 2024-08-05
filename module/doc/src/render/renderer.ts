import path from 'node:path';

import { type ManifestContext, PackageUtil } from '@travetto/manifest';
import { isJSXElement, JSXElement, JSXFragmentType } from '@travetto/doc/jsx-runtime';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

import { EMPTY_ELEMENT, getComponentName, JSXElementByFn, c } from '../jsx';
import { DocumentShape, RenderProvider, RenderState } from '../types';
import { DocFileUtil } from '../util/file';

import { RenderContext } from './context';
import { Html } from './html';
import { Markdown } from './markdown';

const providers = { [Html.ext]: Html, [Markdown.ext]: Markdown };

/**
 * Doc Renderer
 */
export class DocRenderer {

  static async get(file: string, manifest: Pick<ManifestContext, 'workspace'>): Promise<DocRenderer> {
    const imp = RuntimeIndex.getFromSource(file)?.import;
    if (!imp) {
      throw new Error(`Unable to render ${file}, not in the manifest`);
    }
    const res = await Runtime.import<DocumentShape>(imp);

    const pkg = PackageUtil.readPackage(manifest.workspace.path);
    const repoBaseUrl = pkg.travetto?.doc?.baseUrl ?? manifest.workspace.path;
    return new DocRenderer(res,
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

  async #render(
    renderer: RenderProvider<RenderContext>,
    node: JSXElement[] | JSXElement | string | bigint | object | number | boolean | null | undefined,
    stack: JSXElement[] = []
  ): Promise<string> {

    if (node === null || node === undefined) {
      return '';
    } else if (Array.isArray(node)) {
      const out: string[] = [];
      for (const el of node) {
        out.push(await this.#render(renderer, el, stack));
      }
      return out.join('');
    } else if (isJSXElement(node)) {
      let final: JSXElement = node;
      // Render simple element if needed
      if (typeof node.type === 'function' && node.type !== JSXFragmentType) {
        // @ts-expect-error
        const out = node.type(node.props);
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
          el: final, props: final.props, recurse, stack, context: this.#support
        };
        state.createState = (key, props) => this.createState(state, key, props);
        // @ts-expect-error
        return renderer[name](state);
      } else {
        console.log(final);
        throw new Error(`Unknown element: ${final.type}`);
      }
    } else {
      switch (typeof node) {
        case 'string': return node.replace(/&nbsp;/g, ' ');
        case 'number':
        case 'bigint':
        case 'boolean': return `${node}`;
        case 'function': {
          const source = DocFileUtil.readSource(node);
          if (source.file) {
            const title = (await DocFileUtil.isDecorator(node.name, source.file)) ? `@${node.name}` : node.name;
            const el = this.#support.createElement('CodeLink', {
              src: source.file,
              startRe: new RegExp(`(class|function)\\s+(${node.name})`),
              title
            });
            // @ts-expect-error
            const state: RenderState<JSXElementByFn<'CodeLink'>, RenderContext> = {
              el, props: el.props, recurse: async () => '', context: this.#support, stack: []
            };
            // @ts-expect-error
            state.createState = (key, props) => this.createState(state, key, props);
            return await renderer.CodeLink(state);
          }
          break;
        }
      }
      throw new Error(`Unknown object type: ${typeof node}`);
    }
  }

  createState<K extends keyof typeof c>(
    state: RenderState<JSXElement, RenderContext>,
    key: K,
    props: JSXElementByFn<K>['props']
    // @ts-expect-error
  ): RenderState<JSXElementByFn<K>, RenderContext> {
    const el = this.#support.createElement(key, props);
    return { ...state, el, props: el.props };
  }

  /**
   * Render a context given a specific renderer
   * @param renderer
   */
  async render(fmt: keyof typeof providers): Promise<string> {
    if (!providers[fmt]) {
      throw new Error(`Unknown renderer with format: ${fmt}`);
    }
    if (!this.#rootNode) {
      this.#rootNode = (Array.isArray(this.#root.text) || isJSXElement(this.#root.text)) ?
        this.#root.text : await (this.#root.text());
    }

    const text = await this.#render(providers[fmt], this.#rootNode);
    let cleaned = `${text.replace(/\n{3,100}/msg, '\n\n').trim()}\n`;
    if (this.#root.wrap?.[fmt]) {
      cleaned = this.#root.wrap[fmt](cleaned);
    }
    return providers[fmt].finalize(cleaned, this.#support);
  }
}