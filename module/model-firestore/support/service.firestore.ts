import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.FIRESTORE_VERSION || 'latest';

export const service: ServiceDescriptor = {
  name: 'firestore',
  version,
  ports: { 7000: 8080 },
  env: {
    FIRESTORE_PROJECT_ID: 'trv-local-dev'
  },
  image: `ridedott/firestore-emulator:${version}`
};