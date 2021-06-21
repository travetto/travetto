import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from '../lib/types';
import { PackUtil } from '../lib/util';
import { Assemble, AssembleConfig } from './assemble';
import { Docker, DockerConfig } from './docker';
import { Zip, ZipConfig } from './zip';

type DeepPartial<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]?: (T[P] extends (number | string | boolean | undefined | RegExp | ((...args: any[]) => any)) ?
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

export const Pack: PackOperation<AllConfig> = {
  key: '',
  title: 'Packing',
  extend(a: AllConfig, b: Partial<AllConfig>) {
    const ret: Partial<AllConfig> = {
      workspace: b.workspace ?? a.workspace,
    };
    for (const [k, op] of Object.entries(ops) as ['assemble', typeof Assemble][]) {
      // @ts-ignore
      ret[k] = op.extend(a[k] ?? {}, op.extend(b[k] ?? {}, op.overrides ?? {}));
      ret[k]!.workspace = ret.workspace!;
    }

    return ret as AllConfig;
  },
  async context(cfg: AllConfig) {
    return `[ ${Object.entries(ops).filter(x => cfg[x[0] as 'assemble'].active).map(x => x[0]).join(', ')} ]`;
  },
  async * exec(cfg: AllConfig) {
    const steps = Object.entries(ops).filter(x => cfg[x[0] as 'assemble'].active);
    if (!steps.length) {
      throw new Error('Pack operation has zero active steps');
    }
    for (const [step, op] of steps) {
      process.stdout.write('\n');
      await PackUtil.runOperation(op as typeof Assemble, cfg[step as 'assemble'], 2);
    }
    process.stdout.write('\n');
    yield color`${{ success: 'Successfully' }} packed project`;
  }
};