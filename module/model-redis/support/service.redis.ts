import { Env } from '@travetto/base';
import type { Service } from '@travetto/command/support/bin/service';

const version = Env.get('REDIS_VERSION', '5');

export const service: Service = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};