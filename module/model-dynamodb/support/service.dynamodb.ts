import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.DYNAMODB_VERSION || '3.1.0';

export const service: ServiceDescriptor = {
  name: 'dynamodb',
  version,
  port: 8000,
  image: `amazon/dynamodb-local:${version}`
};