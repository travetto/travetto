import { color } from '@travetto/boot/src/cli';

import { CommonConfig, PackOperation } from './lib/types';
import { PackUtil } from './lib/util';
import { Assemble, AssembleConfig } from './assemble';
import { Docker, DockerConfig } from './docker';
import { Zip, ZipConfig } from './zip';

type DeepPartial<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]?: (T[P] extends (number | string | boolean | undefined | RegExp | ((...args: any[]) => any)) ?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (T[P] | undefined) : (T[P] extends any[] ? DeepPartial<T[P][number]>[] : DeepPartial<T[P]>));
};

const ops = {
  [Assemble.key]: Assemble,
  [Zip.key]: Zip,
  [Docker.key]: Docker
} as const;

export type AllConfig = CommonConfig &
{ assemble: AssembleConfig } &
{ zip: ZipConfig } &
{ docker: DockerConfig };

export type AllConfigPartial = DeepPartial<AllConfig>;

type DefaultOpType = ['assemble', typeof Assemble];

export const Pack: PackOperation<AllConfig, ''> = {
  key: '',
  title: 'Packing',
  buildConfig(configs: Partial<AllConfig>[]): AllConfig {
    const ret: Partial<AllConfig> = {
      workspace: configs[0].workspace,
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [k, op] of (Object.entries(ops) as DefaultOpType[])) {
      ret[k] = op.buildConfig(configs.map(config => config[k] ?? {}));
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ret as AllConfig;
  },
  async context(cfg: AllConfig) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return `[ ${(Object.entries(ops) as DefaultOpType[])
      .filter(x => cfg[x[0]].active)
      .map(x => x[0])
      .join(', ')} ]`;
  },
  async * exec(cfg: AllConfig) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const steps = (Object.entries(ops) as DefaultOpType[])
      .filter(x => cfg[x[0]].active);

    if (!steps.length) {
      throw new Error('Pack operation has zero active steps');
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [step, op] of steps as DefaultOpType[]) {
      process.stdout.write('\n');
      cfg[step].workspace = cfg.workspace;
      await PackUtil.runOperation(op, cfg[step], 2);
    }
    process.stdout.write('\n');
    yield color`${{ success: 'Successfully' }} packed project`;
  }
};