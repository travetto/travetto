import { MessageOptions } from './types';

export interface MailTemplateOptions extends MessageOptions {
  template: string;
  context?: MailTemplateContext;
}

export interface MailTemplateContext {
  [key: string]: any;
}

export abstract class MailTemplateEngine {
  abstract template(template: string, ctx: MailTemplateContext): Promise<{ html: string, text?: string }>;
  abstract interpolate(text: string, ctx: MailTemplateContext): Promise<string>;
}