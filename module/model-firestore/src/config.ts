import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('model.firestore')
export class FirestoreModelConfig {
  databaseURL?: string;
  credentials?: string;
  emulator?: string;
  projectId: string;
  namespace: string;
  autoCreate?: boolean;

  async postConstruct() {
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
    if (this.credentials) {
      this.credentials = JSON.parse(await ResourceManager.read(this.credentials, 'utf8'));
    }
  }
}