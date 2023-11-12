import { ResourceLoader } from '@travetto/base';
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
      const resources = new ResourceLoader();
      this.credentials = JSON.parse(await resources.read(this.credentialsFile));
    }
  }
}