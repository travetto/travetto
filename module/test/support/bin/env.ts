import { EnvInit } from '@travetto/base/support/bin/env';

export function envInit(localOptional = true, dynamic: boolean = false): void {
  EnvInit.init({
    ...(dynamic ? { dynamic } : {}),
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: 'test/resources',
      TRV_PROFILES: 'test',
    }
  });
}