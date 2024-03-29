import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}