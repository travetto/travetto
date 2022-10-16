import { Suite } from '@travetto/test';

import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from '../support/test/crud';
import { ModelExpirySuite } from '../support/test/expiry';
import { ModelStreamSuite } from '../support/test/stream';
import { ModelIndexedSuite } from '../support/test/indexed';
import { ModelBasicSuite } from '../support/test/basic';
import { ModelPolymorphismSuite } from '../support/test/polymorphism';

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