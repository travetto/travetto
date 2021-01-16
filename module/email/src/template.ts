import * as Mustache from 'mustache';

import { Injectable } from '@travetto/di';
import { ResourceManager } from '@travetto/base';

/**
 * Mail templating engine
 *
 * @concrete ./internal/types:MailTemplateEngineTarget
 */
export interface MailTemplateEngine {
  /**
  * Resolved nested templates
  */
  resolveNested(template: string): Promise<string>;

  /**
   * Interpolate a string with a given context, useful for simple messages
   */
  template(text: string, ctx: Record<string, unknown>): Promise<string> | string;
}

@Injectable()
export class MustacheTemplateEngine implements MailTemplateEngine {

  /**
   * Resolved nested templates
   */
  async resolveNested(template: string): Promise<string> {
    const promises: Promise<string>[] = [];
    template = template.replace(/[{]{2}>\s+(\S+)([.]html)?\s*[}]{2}/g, (all: string, name: string) => {
      promises.push(
        ResourceManager.read(`${name}.html`, 'utf8') // Ensure html file
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
  template(text: string, data: Record<string, unknown>) {
    return Mustache.render(text, data);
  }
}