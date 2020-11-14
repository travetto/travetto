import * as dynamodb from '@aws-sdk/client-dynamodb';
import { Config } from '../../rest/node_modules/@travetto/config';

@Config('model.dynamodb')
export class DynamoDBModelConfig {
  config: dynamodb.DynamoDBClientConfig = {};
  namespace: string;
}