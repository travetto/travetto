import { Inject, Injectable } from '@travetto/di';
import type { ModelIndexedSupport } from '@travetto/model-indexed';

import { {{modelVar}}ByName } from '../model/{{modelFile}}.indexes.ts';
import { {{modelName}} } from '../model/{{modelFile}}.ts';

@Injectable()
export class {{modelName}}IndexedService {
  @Inject()
  source: ModelIndexedSupport;

  getByName(name: string): Promise<{{modelName}}> {
    return this.source.getByIndex({{modelName}}, {{modelVar}}ByName, { name });
  }
}
