import { MessageOptions } from './types';

// TODO: Document
export interface MailTemplateOptions extends MessageOptions {
  template: string;
  context?: MailTemplateContext;
}

// TODO: Document
export interface MailTemplateContext {
  [key: string]: any;
}

// TODO: Document
export abstract class MailTemplateEngine {
  abstract template(template: string, ctx: MailTemplateContext): Promise<{ html: string, text?: string }>;
  abstract interpolate(text: string, ctx: MailTemplateContext): Promise<string>;
}