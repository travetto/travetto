import { RuntimeResources } from '@travetto/runtime';
import { Config } from '@travetto/config';

@Config('model.firestore')
export class FirestoreModelConfig {

  databaseURL?: string;
  credentialsFile?: string;
  emulator?: string;
  projectId: string;
  namespace?: string;
  autoCreate?: boolean;
  credentials?: {
    client_email: string;
    project_id: string;
    private_key: string;
  };

  async postConstruct(): Promise<void> {
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
    if (this.credentialsFile && !this.credentials) {
      this.credentials = JSON.parse(await RuntimeResources.read(this.credentialsFile));
    }
  }
}