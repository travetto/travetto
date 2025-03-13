import path from 'node:path';

import { EmailTemplateModule, EmailTemplateLocation, EmailResourceLoader } from '@travetto/email';
import { PackageUtil } from '@travetto/manifest';
import { JSXElement } from '@travetto/email-inky/jsx-runtime';

import { InkyRenderer } from './render/renderer.ts';
import { Html } from './render/html.ts';
import { Markdown } from './render/markdown.ts';
import { Subject } from './render/subject.ts';

export async function prepare(node: JSXElement, loc: EmailTemplateLocation): Promise<EmailTemplateModule> {
  const ctx = {
    ...loc,
    loader: new EmailResourceLoader(loc.module, [path.dirname(PackageUtil.resolveImport('foundation-emails/scss/_global.scss'))])
  };
  return {
    loader: ctx.loader,
    globalStyles: `
  @import 'email/inky.variables';
  @import '_global';
  @import 'foundation-emails';
  `,
    html: () => InkyRenderer.render(node, Html, ctx),
    text: () => InkyRenderer.render(node, Markdown, ctx),
    subject: () => InkyRenderer.render(node, Subject, ctx),
  };
}
