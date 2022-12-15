import { Env } from '@travetto/base';
import type { Service } from '@travetto/command/support/bin/service';

const version = Env.get('TRV_SERVICE_MONGO', '4.4');

export const service: Service = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};