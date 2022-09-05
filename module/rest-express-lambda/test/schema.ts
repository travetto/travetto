import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}