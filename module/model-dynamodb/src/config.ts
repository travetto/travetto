import * as dynamodb from '@aws-sdk/client-dynamodb';

import { Config } from '@travetto/config';
import { Field } from '@travetto/schema';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  @Field(Object)
  client: dynamodb.DynamoDBClientConfig = {
    endpoint: undefined
  };
  autoCreate?: boolean;
  namespace?: string;
}