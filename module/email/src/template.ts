import * as Mustache from 'mustache';
import { Injectable } from '@travetto/di';

/**
 * Mail templating engine
 */
export abstract class MailTemplateEngine {
  /**
   * Interpolate a string with a given context, useful for simple messages
   */
  abstract template(text: string, ctx: Record<string, any>): Promise<string> | string;
}


@Injectable()
export class MustacheTemplateEngine extends MailTemplateEngine {
  /**
 * Interpolate text with data
 */
  template(text: string, data: any) {
    return Mustache.render(text, data);
  }
}