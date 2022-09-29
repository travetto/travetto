import { EnvInit } from '@travetto/base/bin/init';
import { ExecUtil } from '@travetto/boot';

import { ApplicationConfig } from '../src/types';

import { AppListUtil } from '../support/bin/list';

/**
 * Entry point when run directly
 */
export async function main(): Promise<ApplicationConfig[]> {
  EnvInit.init();
  return AppListUtil.getList()
    .then(l => l ?? [])
    .then(ExecUtil.mainResponse, ExecUtil.mainResponse);
}