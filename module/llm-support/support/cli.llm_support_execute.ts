import path from 'node:path';

import { CliCommand, CliFlag } from '@travetto/cli';
import { MinLength } from '@travetto/schema';

import { executeOperations } from '../src/execute.ts';
import { LlmSupportCommandBase } from './base-command.ts';

/**
 * Execute llm-support operations with dry-run by default.
 */
@CliCommand()
export class LlmSupportExecuteCommand extends LlmSupportCommandBase {
  @CliFlag({ short: 'o', full: 'operations' })
  @MinLength(1)
  operations?: string[];

  @CliFlag({ short: 'd', full: 'dir' })
  targetDir = process.cwd();

  @CliFlag({ full: 'apply' })
  apply = false;

  @CliFlag({ full: 'overwrite' })
  overwrite = false;

  @CliFlag({ full: 'monorepo' })
  monorepo = false;

  @CliFlag({ full: 'workspace-path' })
  workspacePath?: string;

  @CliFlag({ full: 'workspace-name' })
  workspaceName?: string;

  @CliFlag({ full: 'route-path' })
  routePath?: string;

  @CliFlag({ full: 'controller-name' })
  controllerName?: string;

  @CliFlag({ full: 'service-name' })
  serviceName?: string;

  @CliFlag({ full: 'model-name' })
  modelName?: string;

  @CliFlag({ full: 'project-name' })
  projectName?: string;

  @CliFlag({ full: 'email-name' })
  emailName?: string;

  @CliFlag({ full: 'send-route-path' })
  sendRoutePath?: string;

  async main(): Promise<void> {
    const operations = this.operations ?? [];

    const payload = await executeOperations({
      operations,
      targetDir: path.resolve(this.targetDir),
      dryRun: !this.apply,
      overwrite: this.overwrite,
      monorepo: this.monorepo,
      workspacePath: this.workspacePath,
      workspaceName: this.workspaceName,
      routePath: this.routePath,
      controllerName: this.controllerName,
      serviceName: this.serviceName,
      modelName: this.modelName,
      projectName: this.projectName,
      emailName: this.emailName,
      sendRoutePath: this.sendRoutePath
    });

    await this.writeOutput(payload, true);
  }
}
