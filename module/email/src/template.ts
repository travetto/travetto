import { render } from 'mustache';

import { Injectable } from '@travetto/di';
import { RuntimeResources } from '@travetto/base';

/**
 * Mail interpolation engine
 *
 * @concrete ./internal/types#MailInterpolatorTarget
 */
export interface MailInterpolator {
  /**
  * Resolved nested templates
  */
  resolveNested(template: string): Promise<string>;

  /**
   * Interpolate a string with a given context
   */
  render(text: string, ctx: Record<string, unknown>): Promise<string> | string;
}

@Injectable()
export class MustacheInterpolator implements MailInterpolator {

  /**
   * Resolved nested templates
   */
  async resolveNested(template: string): Promise<string> {
    const promises: Promise<string>[] = [];
    template = template.replace(/[{]{2,3}>\s+(\S+)([.]html)?\s*[}]{2,3}/g, (all: string, name: string) => {
      promises.push(
        RuntimeResources.read(`${name}.html`) // Ensure html file
          .then(contents => this.resolveNested(contents))
      );
      return `$%${promises.length - 1}%$`;
    });
    const resolved = await Promise.all(promises);
    return template.replace(/[$]%(\d+)%[$]/g, (__, idx) => resolved[+idx]);
  }

  /**
   * Interpolate text with data
   */
  render(text: string, data: Record<string, unknown>): string {
    return render(text, data);
  }
}