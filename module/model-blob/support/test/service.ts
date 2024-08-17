import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { Class } from '@travetto/runtime';
import { Inject } from '@travetto/di';
import { NotFoundError } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { AssetService } from '../../src/service';
import { AssetUtil } from '../../src/util';
import { HashNamingStrategy } from '../../src/naming';

@Suite()
@ModelSuite()
@InjectableSuite()
export abstract class AssetServiceSuite {

  @Inject()
  assetService: AssetService;

  serviceClass: Class;
  configClass: Class;
  fixture = new TestFixtures(['@travetto/asset']);

}