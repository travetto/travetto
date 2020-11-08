import { Suite } from '@travetto/test';
import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from './lib/crud';

@Suite()
export class MemoryCrudSuite extends ModelCrudSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}