import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';
import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema.ts';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}