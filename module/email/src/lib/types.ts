import * as nodemailer from 'nodemailer';

export interface TemplateMailOptions extends nodemailer.SendMailOptions {
  template?: string;
  context?: TemplateContext;
  body?: string;
};

export interface TemplateContext {
  foundationHtml?: string;
  foundationCss?: string;
  [key: string]: any;
}