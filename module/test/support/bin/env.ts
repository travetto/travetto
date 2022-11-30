import { Env } from '@travetto/base';

export function envInit(dynamic: boolean = false): void {
  Env.define({
    dynamic: dynamic || undefined,
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_PROFILES: 'test',
    }
  });
}