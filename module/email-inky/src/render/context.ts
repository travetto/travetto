import { createElement } from '@travetto/email-inky/jsx-runtime';

import { JSXElementByFn, c } from '../components';

/**
 * Render Context
 */
export class RenderContext {

  columnCount: number = 12;

  /**
   * Create a new element from a given JSX factory
   */
  createElement<K extends keyof typeof c>(name: K, props: JSXElementByFn<K>['props']): JSXElementByFn<K> {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return createElement(c[name], props) as JSXElementByFn<K>;
  }
}