import * as dynamodb from '@aws-sdk/client-dynamodb';
import { Config } from '@travetto/config';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  config: dynamodb.DynamoDBClientConfig = {
    endpoint: undefined
  };
  autoCreate?: boolean;
  namespace: string;
}