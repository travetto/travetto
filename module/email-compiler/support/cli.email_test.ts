import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';

import { EmailCompiler } from '../src/compiler';

import { EditorService } from './bin/editor';

/**
 * CLI Entry point for running the email server
 */
@CliCommand({ addEnv: true })
export class EmailTestCommand implements CliCommandShape {

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file);
    await RootRegistry.init();
    await EmailCompiler.compile(file, true);
    const editor = await DependencyRegistry.getInstance(EditorService);
    await editor.onSend({ type: 'send', file, to });
  }
}