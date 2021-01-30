import type { Service } from '@travetto/command/bin/lib/service';

const version = '3.6';

export const service: Service = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};