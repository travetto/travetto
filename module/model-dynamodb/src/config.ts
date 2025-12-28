import type dynamodb from '@aws-sdk/client-dynamodb';

import { Config } from '@travetto/config';
import { Runtime } from '@travetto/runtime';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  client: dynamodb.DynamoDBClientConfig = {
    endpoint: undefined
  };
  modifyStorage?: boolean;
  namespace?: string;

  postConstruct(): void {
    if (!Runtime.production) {
      this.client.endpoint ??= 'http://localhost:8000'; // From docker
    }
  }
}