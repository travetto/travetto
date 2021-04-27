import { EnvUtil } from '@travetto/boot';
import type { Service } from '@travetto/command/bin/lib/service';

const version = EnvUtil.get('TRV_SERVICE_MONGO', '4.4');

export const service: Service = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};