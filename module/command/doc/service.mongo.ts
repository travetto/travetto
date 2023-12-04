import type { CommandService } from '@travetto/command';

const version = process.env.MONGO_VERSION || '4.4';

export const service: CommandService = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};