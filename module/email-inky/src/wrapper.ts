import { EmailTemplateModule, EmailTemplateLocation, EmailResourceLoader } from '@travetto/email';
import { PackageUtil, path } from '@travetto/manifest';
import { JSXElement } from '@travetto/doc/jsx-runtime';

import { InkyRenderer } from './render/renderer';
import { Html } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

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
