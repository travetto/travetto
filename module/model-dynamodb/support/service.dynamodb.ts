import { Env } from '@travetto/base';
import type { CommandService } from '@travetto/command';

const version = Env.get('DYNAMODB_VERSION', '1.15.0');

export const service: CommandService = {
  name: 'dynamodb',
  version,
  port: 8000,
  image: `amazon/dynamodb-local:${version}`
};