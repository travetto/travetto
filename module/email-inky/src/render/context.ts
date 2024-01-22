import { createElement } from '@travetto/email-inky/jsx-runtime';
import { FileLoader, ModuleResourceLoader } from '@travetto/base';
import { EmailTemplateLocation } from '@travetto/email';

import { JSXElementByFn, c } from '../components';

export type RenderContextInit = EmailTemplateLocation & { loader?: FileLoader, columnCount?: number };

/**
 * Render Context
 */
export class RenderContext implements RenderContextInit {

  columnCount: number = 12;
  file: string;
  module: string;
  loader: FileLoader;

  constructor(ctx: RenderContextInit) {
    Object.assign(this, ctx);
    this.loader ??= new ModuleResourceLoader(ctx.module);
  }

  /**
   * Create a new element from a given JSX factory
   */
  createElement<K extends keyof typeof c>(name: K, props: JSXElementByFn<K>['props']): JSXElementByFn<K> {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return createElement(c[name], props) as JSXElementByFn<K>;
  }
}