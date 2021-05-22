import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('model.firestore')
export class FirestoreModelConfig {
  databaseURL?: string;
  credential?: string;
  emulator?: string;
  projectId: string;
  namespace: string;
  autoCreate?: boolean;

  async postConstruct() {
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
    if (this.credential) {
      this.credential = firebase.credential.cert(await ResourceManager.findAbsolute(this.credential));
    }
  }
}