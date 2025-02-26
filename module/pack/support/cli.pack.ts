import { CliCommand } from '@travetto/cli';

import { BasePackCommand } from './pack.base.ts';

/**
 * Standard pack support
 */
@CliCommand({ with: { module: true } })
export class PackCommand extends BasePackCommand { }