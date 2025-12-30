import path from 'node:path';

import { EmailTemplateModule, EmailTemplateLocation, EmailResourceLoader } from '@travetto/email';
import { PackageUtil } from '@travetto/manifest';

import { InkyRenderer } from './render/renderer.ts';
import { Html } from './render/html.ts';
import { Markdown } from './render/markdown.ts';
import { Subject } from './render/subject.ts';
import type { JSXElement } from '../support/jsx-runtime.ts';

export async function prepare(node: JSXElement, location: EmailTemplateLocation): Promise<EmailTemplateModule> {
  const ctx = {
    ...location,
    loader: new EmailResourceLoader(location.module, [path.dirname(PackageUtil.resolveImport('foundation-emails/scss/_global.scss'))])
  };
  return {
    loader: ctx.loader,
    globalStyles: `
  @use 'email/inky.variables';
  @use '_global';
  @use 'foundation-emails';
  `,
    html: () => InkyRenderer.render(node, Html, ctx),
    text: () => InkyRenderer.render(node, Markdown, ctx),
    subject: () => InkyRenderer.render(node, Subject, ctx),
  };
}
