import path from 'node:path';

import { CliCommand, CliFlag, CliModuleFlag, type CliCommandShape } from '@travetto/cli';

import { executeOperations } from '../src/execute.ts';

/**
 * Execute llm-support operations with dry-run by default.
 */
@CliCommand()
export class LlmSupportExecuteCommand implements CliCommandShape {

  @CliModuleFlag(({ scope: 'command' }))
  module: string;

  @CliFlag({ short: 'o', full: 'operations' })
  operations?: string[];

  @CliFlag({ short: 'd', full: 'dir' })
  targetDir = process.cwd();

  @CliFlag({ full: 'apply' })
  apply = false;

  @CliFlag({ full: 'overwrite' })
  overwrite = false;

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
    const operations = (this.operations ?? []).filter(Boolean);
    if (!operations.length) {
      throw new Error('At least one operation is required via --operations');
    }

    const payload = await executeOperations({
      operations,
      targetDir: path.resolve(this.targetDir),
      dryRun: !this.apply,
      overwrite: this.overwrite,
      routePath: this.routePath,
      controllerName: this.controllerName,
      serviceName: this.serviceName,
      modelName: this.modelName,
      projectName: this.projectName,
      emailName: this.emailName,
      sendRoutePath: this.sendRoutePath
    });

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}
