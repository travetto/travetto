import { EmailTemplateCore, EmailTemplateLocation } from '@travetto/email';
import { PackageUtil, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';
import { JSXElement } from '@travetto/doc/jsx-runtime';

export async function prepare(node: JSXElement, loc: EmailTemplateLocation): Promise<EmailTemplateCore> {
  return {
    styles: {
      resources: [path.dirname(PackageUtil.resolveImport('foundation-emails/scss/_global.scss'))],
      global: `
  @import 'email/inky.variables';
  @import '_global';
  @import 'foundation-emails';
  `
    },
    html: () => InkyRenderer.render(node, Html, loc),
    text: () => InkyRenderer.render(node, Markdown, loc),
    subject: () => InkyRenderer.render(node, Subject, loc),
  };
}
