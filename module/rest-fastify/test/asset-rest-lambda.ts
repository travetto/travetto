import { AssetRestServerSuite } from '@travetto/asset-rest/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAssetRestLambdaTest extends AssetRestServerSuite {
  constructor() {
    super(true);
  }
}