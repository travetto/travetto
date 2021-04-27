import { EnvUtil } from '@travetto/boot';
import type { Service } from '@travetto/command/bin/lib/service';

const version = EnvUtil.get('TRV_SERVICE_REDIS', '5');

export const service: Service = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};