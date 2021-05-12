import { Suite } from '@travetto/test';

import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from '../test-support/crud';
import { ModelExpirySuite } from '../test-support/expiry';
import { ModelStreamSuite } from '../test-support/stream';
import { ModelIndexedSuite } from '../test-support/indexed';
import { ModelBasicSuite } from '../test-support/basic';
import { ModelPolymorphismSuite } from '../test-support/polymorphism';

@Suite()
export class MemoryBasicSuite extends ModelBasicSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryCrudSuite extends ModelCrudSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryStreamSuite extends ModelStreamSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryExpirySuite extends ModelExpirySuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryIndexedSuite extends ModelIndexedSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryPolymorphicSuite extends ModelPolymorphismSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}