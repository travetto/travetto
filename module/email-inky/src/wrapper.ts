import { createRequire } from 'module';

import { MessageCompilationSource } from '@travetto/email';
import { JSXComponentFunction, JSXElement } from '@travetto/email-inky/jsx-runtime';
import { RootIndex, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html, HtmlWrap } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

export const wrap = (content: JSXElement): MessageCompilationSource => {
  const req = createRequire(`${RootIndex.manifest.workspacePath}/node_modules`);

  return {
    file: '',
    html: InkyRenderer.render.bind(InkyRenderer, { text: content.props.children, wrap: HtmlWrap }, Html),
    text: InkyRenderer.render.bind(InkyRenderer, { text: content.props.children }, Markdown),
    subject: InkyRenderer.render.bind(InkyRenderer, { text: content.props.children }, Subject),
    styles: {
      search: [path.dirname(req.resolve('foundation-emails/scss/_global.scss'))],
      global: `
@import 'email/inky.variables';
@import '_global';
@import 'foundation-emails';
`
    }
  };
};

export const InkyTemplate: JSXComponentFunction<{}> = (): JSXElement => ({ type: '', key: '', props: {} });