import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MONGO_VERSION ?? '7.0';

export const service: ServiceDescriptor = {
  name: 'mongodb',
  version,
  ports: { 27017: 27017 },
  image: `mongo:${version}`
};