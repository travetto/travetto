import type { CommandService } from '@travetto/command';

const version = process.env.REDIS_VERSION || '7.2';

export const service: CommandService = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};