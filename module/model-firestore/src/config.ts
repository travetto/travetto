import { Runtime, RuntimeResources } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Schema, SchemaValidator } from '@travetto/schema';

@Schema()
class FirestoreModelConfigCredentials {
  client_email: string;
  project_id: string;
  private_key: string;
}

@Config('model.firestore')
export class FirestoreModelConfig {
  databaseURL?: string;
  credentialsFile?: string;
  emulator?: string;
  projectId?: string;
  namespace?: string;
  modifyStorage?: boolean;
  credentials?: FirestoreModelConfigCredentials;

  async postConstruct(): Promise<void> {
    if (!this.databaseURL && !Runtime.production) {
      this.projectId ??= 'trv-local-dev';
      this.emulator ??= 'localhost:7000'; // From docker
    }
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
    if (this.credentialsFile && !this.credentials) {
      this.credentials = FirestoreModelConfigCredentials.from(
        await RuntimeResources.readJSON(this.credentialsFile)
      );
      await SchemaValidator.validate(FirestoreModelConfigCredentials, this.credentials);
    }
  }
}