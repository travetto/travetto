import type { Service } from '@travetto/command/bin/lib/service';

const version = '1.15.0';

export const service: Service = {
  name: 'dynamodb',
  version,
  port: 8000,
  image: `amazon/dynamodb-local:${version}`
};