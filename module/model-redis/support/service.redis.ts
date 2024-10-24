import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.REDIS_VERSION || '7.2';

export const service: ServiceDescriptor = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};