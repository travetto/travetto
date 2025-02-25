import { createElement } from '@travetto/email-inky/jsx-runtime.ts';

import { castTo, FileLoader } from '@travetto/runtime';
import { EmailTemplateLocation, EmailResourceLoader } from '@travetto/email';

import { JSXElementByFn, c } from '../components.ts';

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
    this.loader ??= new EmailResourceLoader(ctx.module);
  }

  /**
   * Create a new element from a given JSX factory
   */
  createElement<K extends keyof typeof c>(name: K, props: JSXElementByFn<K>['props']): JSXElementByFn<K> {
    return castTo(createElement(castTo<Record<string, string>>(c)[name], props));
  }
}