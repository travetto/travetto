import { EnvInit } from '@travetto/base/bin/init';
import { ExecUtil } from '@travetto/boot/src';

import { AppListUtil } from './lib/list';

/**
 * Entry point when run directly
 */
export async function main() {
  EnvInit.init({});
  return AppListUtil.getList()
    .then(l => l ?? [])
    .then(ExecUtil.mainResponse, ExecUtil.mainResponse);
}