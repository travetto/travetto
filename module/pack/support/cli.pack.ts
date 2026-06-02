import { CliCommand } from '@travetto/cli';

import { BasePackCommand } from './pack.base.ts';

/**
 * Build a standard module package artifact.
 *
 * This base command produces the default packaged output and serves as the
 * common entry point for module packaging workflows.
 */
@CliCommand()
export class PackCommand extends BasePackCommand { }