import { createRequire } from 'module';

import { MessageTemplate } from '@travetto/email';
import { JSXComponentFunction, JSXElement } from '@travetto/email-inky/jsx-runtime';
import { RootIndex, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

export const wrap = (content: JSXElement): MessageTemplate => {
  const req = createRequire(`${RootIndex.manifest.workspacePath}/node_modules`);

  return {
    config: {
      styles: {
        search: [path.dirname(req.resolve('foundation-emails/scss/_global.scss'))],
        global: `
  @import 'email/inky.variables';
  @import '_global';
  @import 'foundation-emails';
  `
      }
    },
    generators: {
      html: InkyRenderer.render.bind(InkyRenderer, content.props.children!, Html),
      text: InkyRenderer.render.bind(InkyRenderer, content.props.children!, Markdown),
      subject: InkyRenderer.render.bind(InkyRenderer, content.props.children!, Subject),
    }
  };
};

export const InkyTemplate: JSXComponentFunction<{}> = (): JSXElement => ({ type: '', key: '', props: {} });