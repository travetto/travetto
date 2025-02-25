import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';
import { Suite } from '@travetto/test';

@Suite()
export class KoaLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}