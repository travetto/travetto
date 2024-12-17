import type { ServiceDescriptor } from '@travetto/cli';

const version = '3.12.0';

export const service: ServiceDescriptor = {
  name: 's3',
  version,
  privileged: true,
  port: '4566:9090',
  image: `adobe/s3mock:${version}`
};