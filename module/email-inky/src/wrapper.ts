import { EmailCompileSource } from '@travetto/email';
import { JSXElement } from '@travetto/email-inky/jsx-runtime';
import { PackageUtil, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

export const wrap = (content: JSXElement): EmailCompileSource => ({
  styles: {
    search: [path.dirname(PackageUtil.resolveImport('foundation-emails/scss/_global.scss'))],
    global: `
  @import 'email/inky.variables';
  @import '_global';
  @import 'foundation-emails';
  `
  },
  html: InkyRenderer.render.bind(InkyRenderer, content, Html),
  text: InkyRenderer.render.bind(InkyRenderer, content, Markdown),
  subject: InkyRenderer.render.bind(InkyRenderer, content, Subject),
});
