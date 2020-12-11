import { AssetRestServerSuite } from '@travetto/asset-rest/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAssetRestLambdaTest extends AssetRestServerSuite {
  constructor() {
    super(true);
  }
}