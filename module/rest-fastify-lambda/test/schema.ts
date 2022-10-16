import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}