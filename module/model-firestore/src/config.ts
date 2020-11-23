import { Config } from '@travetto/config';

@Config('model.firestore')
export class FirestoreModelConfig {
  databaseURL?: string;
  credential?: string;
  emulator?: string;
  projectId: string;
  namespace: string;

  postConstruct() {
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
  }
}