import { Env } from '@travetto/base';
import type { CommandService } from '@travetto/command';

const version = Env.get('REDIS_VERSION', '7.2');

export const service: CommandService = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};