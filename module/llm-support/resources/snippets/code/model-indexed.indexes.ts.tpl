import { keyedIndex, sortedIndex } from '@travetto/model-indexed';

import { {{modelName}} } from './{{modelFile}}.ts';

export const {{modelVar}}ByName = keyedIndex({{modelName}}, {
  name: '{{modelFile}}_by_name',
  key: { name: true }
});

export const {{modelVar}}ByNameCreatedAt = sortedIndex({{modelName}}, {
  name: '{{modelFile}}_by_name_created_at',
  key: { name: true },
  sort: { createdAt: -1 }
});
