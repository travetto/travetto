import { EmailCompileSource } from '@travetto/email';
import { JSXComponentFunction, JSXElement, JSXFragmentType } from '@travetto/email-inky/jsx-runtime';
import { PackageUtil, path } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer';
import { Html } from './render/html';
import { Markdown } from './render/markdown';
import { Subject } from './render/subject';

export const wrap = (content: JSXElement): EmailCompileSource => {
  const finalContent = { ...content, key: '', type: JSXFragmentType };

  return {
    styles: {
      search: [path.dirname(PackageUtil.resolveImport('foundation-emails/scss/_global.scss'))],
      global: `
  @import 'email/inky.variables';
  @import '_global';
  @import 'foundation-emails';
  `
    },
    html: InkyRenderer.render.bind(InkyRenderer, finalContent, Html),
    text: InkyRenderer.render.bind(InkyRenderer, finalContent, Markdown),
    subject: InkyRenderer.render.bind(InkyRenderer, finalContent, Subject),
  };
};

export const InkyTemplate: JSXComponentFunction<{}> = (): JSXElement => ({ type: '', key: '', props: {} });

export const unwrap = (element: JSXElement): Promise<EmailCompileSource | undefined> =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  (element as unknown as { wrap: (el: JSXElement) => Promise<EmailCompileSource> }).wrap(element);