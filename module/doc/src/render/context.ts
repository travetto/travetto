import path from 'node:path';

import { createElement, JSXRuntimeTag } from '@travetto/doc/jsx-runtime';

import { PackageUtil } from '@travetto/manifest';
import { RuntimeContext, RuntimeIndex } from '@travetto/base';

import { JSXElementByFn, c } from '../jsx';
import { DocResolveUtil, ResolvedCode, ResolvedRef, ResolvedSnippetLink } from '../util/resolve';
import { DocRunUtil } from '../util/run';

/**
 * Render Context
 */
export class RenderContext {

  #executeCache: Record<string, string> = {};

  /**
   * Filename
   */
  file: string;

  /**
   * Github root for project
   */
  baseUrl: string;

  /**
   * Github root for Travetto framework
   */
  travettoBaseUrl: string;

  /**
   * Repository root
   */
  repoRoot: string;

  constructor(file: string, baseUrl: string, repoRoot: string) {

    const manifestPkg = PackageUtil.readPackage(RuntimeIndex.getModule('@travetto/manifest')!.sourcePath);

    this.file = path.resolve(file);
    this.baseUrl = baseUrl;
    this.repoRoot = repoRoot;
    this.travettoBaseUrl = repoRoot.includes('travetto.github') ? repoRoot : manifestPkg.travetto!.doc!.baseUrl!;
  }

  /**
   * Get generated comment
   */
  get generatedStamp(): string {
    return 'This file was generated by @travetto/doc and should not be modified directly';
  }

  /**
   * Get rebuilt comment
   */
  get rebuildStamp(): string {
    return `Please modify ${this.file.replace(this.repoRoot, this.baseUrl)} and execute "npx trv doc" to rebuild`;
  }

  /**
   * Generate link location
   */
  link(text: string, line?: number | { [key: string]: unknown, line?: number }): string {
    const num = typeof line === 'number' ? line : line?.line;
    return `${text.replace(this.repoRoot, this.baseUrl)
      .replace(/.*@travetto\//, `${this.travettoBaseUrl}/module/`)}${num ? `#L${num}` : ''}`;
  }

  /**
   * Clean text
   */
  cleanText(a?: string): string {
    return a ? a.replace(/^[\n ]+|[\n ]+$/gs, '') : '';
  }

  /**
   * Get a consistent anchor id
   */
  getAnchorId(a: string): string {
    return a.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/ /g, '-');
  }

  /**
   * Execute a node that represents a code invocation
   */
  async execute(node: JSXElementByFn<'Execution'>): Promise<string> {
    const key = node[JSXRuntimeTag]?.id ?? 0;
    if (key && this.#executeCache[key]) {
      return this.#executeCache[key];
    }

    const { cmd, args = [], config = {} } = node.props;
    const result = await DocRunUtil.run(cmd, args, config);
    return this.#executeCache[key] = result;
  }

  /**
   * Resolve a reference to a given node
   */
  async resolveRef(node: JSXElementByFn<'Ref'>): Promise<ResolvedRef> {
    return DocResolveUtil.resolveRef(node.props.title, node.props.href);
  }

  /**
   * Resolve code link
   */
  async resolveCodeLink(node: JSXElementByFn<'CodeLink'>): Promise<ResolvedSnippetLink> {
    const src = typeof node.props.src === 'string' ? node.props.src : RuntimeContext.getSource(node.props.src);
    return DocResolveUtil.resolveCodeLink(src, node.props.startRe);
  }

  /**
   * Resolve code/config
   */
  async resolveCode(node: JSXElementByFn<'Code' | 'Config'>): Promise<ResolvedCode> {
    const src = typeof node.props.src === 'string' ? node.props.src : RuntimeContext.getSource(node.props.src);
    return node.props.startRe ?
      DocResolveUtil.resolveSnippet(src, node.props.startRe, node.props.endRe, node.props.outline) :
      DocResolveUtil.resolveCode(src, node.props.language, node.props.outline);
  }

  /**
   * Create a new element from a given JSX factory
   */
  createElement<K extends keyof typeof c>(name: K, props: JSXElementByFn<K>['props']): JSXElementByFn<K> {
    // @ts-expect-error
    return createElement(c[name], props) as JSXElementByFn<K>;
  }
}