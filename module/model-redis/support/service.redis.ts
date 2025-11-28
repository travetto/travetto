import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.REDIS_VERSION || '8.4';

export const service: ServiceDescriptor = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};