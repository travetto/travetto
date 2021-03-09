import { EnvInit } from '@travetto/base/bin/init';
import { CliUtil } from '@travetto/cli/src/util';
import { AppListBinUtil } from './lib/list';

/**
 * Entry point when run directly
 */
export async function main(mode?: 'build') {
  try {
    EnvInit.init({});
    const list = mode === 'build' ? AppListBinUtil.buildList() : AppListBinUtil.getList();
    CliUtil.pluginResponse((await list) ?? []);
  } catch (err) {
    CliUtil.pluginResponse(err);
  }
}