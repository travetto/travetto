import { Config } from '@travetto/config';
import { PostConstruct } from '@travetto/di';
import { JSONUtil, Runtime, RuntimeResources } from '@travetto/runtime';
import { Schema, SchemaValidator } from '@travetto/schema';

@Schema()
class FirestoreModelConfigCredentials {
  client_email: string;
  private_key: string;
}

@Config('model.firestore')
export class FirestoreModelConfig {
  databaseId?: string;
  credentialsFile?: string;
  emulator?: string;
  projectId?: string;
  namespace?: string;
  modifyStorage?: boolean;
  credentials?: FirestoreModelConfigCredentials;

  @PostConstruct()
  async finalizeConfig(): Promise<void> {
    if (!this.projectId && !Runtime.production) {
      this.projectId = 'trv-local-dev';
      this.emulator ??= 'localhost:7000'; // From docker
    }
    if (this.emulator) {
      process.env.FIRESTORE_EMULATOR_HOST = this.emulator;
    }
    if (this.credentialsFile && !this.credentials) {
      const bytes = await RuntimeResources.readBinaryArray(this.credentialsFile);
      this.credentials = FirestoreModelConfigCredentials.from(JSONUtil.fromBinaryArray(bytes));
      await SchemaValidator.validate(FirestoreModelConfigCredentials, this.credentials);
    }
  }
}
