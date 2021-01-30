import type { Service } from '@travetto/command/bin/lib/service';

const version = '5';

export const service: Service = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};