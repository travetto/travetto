import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MONGO_VERSION || '8.2';

export const service: ServiceDescriptor = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};