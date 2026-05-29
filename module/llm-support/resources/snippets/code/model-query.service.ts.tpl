import { Inject, Injectable } from '@travetto/di';
import type { ModelQuerySupport, Query } from '@travetto/model-query';

import { {{modelName}} } from '../model/{{modelFile}}.ts';

@Injectable()
export class {{modelName}}QueryService {
  @Inject()
  source: ModelQuerySupport;

  queryByQuestion(question: string): Promise<{{modelName}}[]> {
    const lowered = question.toLowerCase();
    const query: Query<{{modelName}}> = lowered.includes('recent') ?
      { where: {}, sort: { createdAt: -1 }, limit: 25 } :
      { where: {} };
    return this.source.query({{modelName}}, query);
  }
}
