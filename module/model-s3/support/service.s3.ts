import type { CommandService } from '@travetto/command';

const version = '3.0.0';

export const service: CommandService = {
  name: 's3',
  version,
  privileged: true,
  ports: { 9090: 4566 },
  image: `adobe/s3mock:${version}`
};