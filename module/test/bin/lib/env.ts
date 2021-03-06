import { CompileCliUtil } from '@travetto/compiler/bin/lib';

export const DEF_ENV = { env: 'test', debug: '0', resources: ['test/resources'], profiles: ['test'] };
export const ENV_EXT = { TRV_LOG_TIME: 0 };

export async function load() {
  process.env.TRV_SRC_LOCAL = `^test,${process.env.TRV_SRC_LOCAL ?? ''}`;
  process.env.TRV_SRC_COMMON = `^test-support,${process.env.TRV_SRC_COMMON ?? ''}`;

  await CompileCliUtil.compile();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:compiler/load');
}
