import { Suite } from '@travetto/test';
import { FileModelConfig, FileModelService } from '../src/provider/file';
import { ModelCrudSuite } from './lib/crud';

@Suite()
export class FileCrudSuite extends ModelCrudSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}