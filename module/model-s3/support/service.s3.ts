import * as fs from 'fs';
import * as os from 'os';

import type { Service } from '@travetto/command/bin/lib/service';

const temp = `${os.tmpdir()}/local-stack`;
try {
  fs.mkdirSync(temp);
} catch { }

export const service: Service = {
  name: 's3',
  version: 'latest',
  privileged: true,
  env: {
    TEST_AWS_ACCOUNT_ID: '000000000000',
    LOCALSTACK_HOSTNAME: 'localhost',
    DEFAULT_REGION: 'us-east-1',
    HOST_TMP_FOLDER: temp
  },
  volumes: {
    [temp]: '/tmp/localstack'
  },
  ports: { 4566: 4566, 4571: 4571, 8080: 8080, 8081: 8081 },
  image: 'localstack/localstack'
};