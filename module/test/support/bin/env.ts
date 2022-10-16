import { EnvInit } from '@travetto/base/support/bin/init';
import { Host } from '@travetto/boot';

export function envInit(localOptional = true, dynamic: boolean = false): void {
  EnvInit.init({
    ...(dynamic ? { dynamic } : {}),
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: `${Host.PATH.test}/${Host.PATH.resources}`,
      TRV_PROFILES: 'test',
    }
  });
}