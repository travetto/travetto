import { MessageOptions } from './types';

/**
 * Options for templating a message
 */
export interface MailTemplateOptions extends MessageOptions {
  /**
   * Template content
   */
  template: string;
  /**
   * Context for templating
   */
  context?: Record<string, any>;
}

/**
 * Mail templating engine
 */
export abstract class MailTemplateEngine {
  /**
   * Supports templating an email into the html/text output
   */
  abstract template(template: string, ctx: Record<string, any>): Promise<{ html: string, text?: string }>;
  /**
   * Interpolate a string with a given context, useful for simple messages
   */
  abstract interpolate(text: string, ctx: Record<string, any>): Promise<string>;
}