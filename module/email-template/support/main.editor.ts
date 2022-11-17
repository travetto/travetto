import { path } from '@travetto/boot';
import { Env } from '@travetto/base';

import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';
import { MailTemplateEngine } from '@travetto/email';

import { EmailTemplateResource } from '../src/resource';
import { EmailTemplateCompiler } from '../src/compiler';

import { EditorState } from './bin/editor';
import { TemplateManager } from './bin/template';

/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  Env.define({
    append: { TRV_RESOURCES: path.resolve(path.dirname(__output), 'resources') }
  });

  await RootRegistry.init();

  const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);

  const resources = new EmailTemplateResource();
  const compiler = new EmailTemplateCompiler(resources);

  await new EditorState(new TemplateManager(engine, compiler)).init();
}