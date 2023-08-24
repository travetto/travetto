import type { CommandService } from '@travetto/command';

const version = '3.1.0';

export const service: CommandService = {
  name: 's3',
  version,
  privileged: true,
  ports: { 4566: 9090 },
  image: `adobe/s3mock:${version}`
};