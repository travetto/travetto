import { Suite } from '@travetto/test';
import { FileModelConfig, FileModelService } from '../src/provider/file';
import { ModelCrudSuite } from './lib/crud';
import { ModelStreamSuite } from './lib/stream';

@Suite()
export class FileCrudSuite extends ModelCrudSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}

@Suite()
export class FileStreamSuite extends ModelStreamSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}