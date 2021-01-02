import { Suite } from '@travetto/test';
import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from '../test-support/crud';
import { ModelExpirySuite } from '../test-support/expiry';
import { ModelStreamSuite } from '../test-support/stream';
import { ModelIndexedSuite } from '../test-support/indexed';

@Suite()
export class MemoryCrudSuite extends ModelCrudSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}

@Suite()
export class MemoryStreamSuite extends ModelStreamSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}

@Suite()
export class MemoryExpirySuite extends ModelExpirySuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}

@Suite()
export class MemoryIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}