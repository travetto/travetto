import { EnvInit } from '@travetto/base/support/bin/init';
import { ModuleExec } from '@travetto/boot/src/internal/module-exec';

import { ApplicationConfig } from '../src/types';

import { AppListLoader } from './bin/list';

/**
 * Entry point when run directly
 */
export async function main(): Promise<ApplicationConfig[]> {
  EnvInit.init();
  return AppListLoader.getList()
    .then(l => l ?? [])
    .then(ModuleExec.mainResponse, ModuleExec.mainResponse);
}