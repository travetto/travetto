// @with-module @travetto/asset-rest

import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAssetRestTest extends AssetRestServerSuite { }