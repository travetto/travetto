import { createRequire } from 'module';

import { MessageCompilationSource } from '@travetto/email';
import { JSXElement } from '@travetto/email-inky/jsx-runtime';
import { RootIndex, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html, HtmlWrap } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

const req = createRequire(`${RootIndex.manifest.workspacePath}/node_modules`);

export const inkyTpl = (content: JSXElement | JSXElement[]): MessageCompilationSource => ({
  file: '',
  html: InkyRenderer.render.bind(InkyRenderer, { text: content, wrap: HtmlWrap }, Html),
  text: InkyRenderer.render.bind(InkyRenderer, { text: content }, Markdown),
  subject: InkyRenderer.render.bind(InkyRenderer, { text: content }, Subject),
  styles: {
    search: [path.dirname(req.resolve('foundation-emails/scss/_global.scss'))],
    global: `
@import 'email/inky.variables';
@import '_global';
@import 'foundation-emails';
`
  }
});
