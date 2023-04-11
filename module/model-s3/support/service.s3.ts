import { mkdirSync } from 'fs';
import os from 'os';

import type { CommandService } from '@travetto/command';

const temp = `${os.tmpdir()}/local-stack`;
try {
  mkdirSync(temp);
} catch { }

const version = '2.0.1';

export const service: CommandService = {
  name: 's3',
  version,
  privileged: true,
  env: {
    TEST_AWS_ACCOUNT_ID: '000000000000',
    LOCALSTACK_HOSTNAME: 'localhost',
    DEFAULT_REGION: 'us-east-1',
    HOST_TMP_FOLDER: temp
  },
  volumes: {
    [temp]: '/var/lib/localstack'
  },
  ports: { 4566: 4566, 4571: 4571, 8080: 8080, 8081: 8081 },
  image: `localstack/localstack:${version}`
};