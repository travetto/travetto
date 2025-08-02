import type { ServiceDescriptor } from '@travetto/cli';

const version = '4.7.0';

export const service: ServiceDescriptor = {
  name: 's3',
  version,
  privileged: true,
  port: '4566:9090',
  image: `adobe/s3mock:${version}`
};