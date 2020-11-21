import { Suite } from '@travetto/test';
import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from './lib/crud';
import { ModelExpirySuite } from './lib/expiry';
import { ModelStreamSuite } from './lib/stream';
import { ModelIndexedSuite } from './lib/indexed';

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