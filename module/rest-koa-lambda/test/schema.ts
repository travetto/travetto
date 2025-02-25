import { Suite } from '@travetto/test';

import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';

@Suite()
export class KoaLambdaSchemaTest extends SchemaRestServerSuite {
  type = AwsLambdaRestServerSupport;
}