import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MONGO_VERSION || '8.3';

export const service: ServiceDescriptor = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`,
  env: {
    // Temp until mongo image fixes orbstack issue
    GLIBC_TUNABLES: 'glibc.pthread.rseq=1'
  }
};