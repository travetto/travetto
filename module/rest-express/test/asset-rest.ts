import { AssetRestServerSuite } from '@travetto/asset-rest/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAssetRestTest extends AssetRestServerSuite {
  constructor() {
    super(3002);
  }
}