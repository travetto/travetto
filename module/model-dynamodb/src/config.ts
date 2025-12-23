import type dynamodb from '@aws-sdk/client-dynamodb';

import { Config } from '@travetto/config';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  client: dynamodb.DynamoDBClientConfig = {
    endpoint: undefined
  };
  modifyStorage?: boolean;
  namespace?: string;
}