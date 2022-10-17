import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test.server';
import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}