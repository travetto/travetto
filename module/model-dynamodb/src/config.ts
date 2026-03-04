import type dynamodb from '@aws-sdk/client-dynamodb';

import { Config } from '@travetto/config';
import { PostConstruct } from '@travetto/di';
import { Runtime } from '@travetto/runtime';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  client: dynamodb.DynamoDBClientConfig = {
    endpoint: undefined
  };
  modifyStorage?: boolean;
  namespace?: string;

  @PostConstruct()
  finalizeConfig(): void {
    if (!Runtime.production) {
      this.client.endpoint ??= 'http://localhost:8000'; // From docker
    }
  }
}