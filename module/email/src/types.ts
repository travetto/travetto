import * as nodemailer from 'nodemailer';

export interface TemplateMailOptions extends nodemailer.SendMailOptions {
  template: string;
  context?: TemplateContext;
};

export interface TemplateContext {
  [key: string]: any;
}