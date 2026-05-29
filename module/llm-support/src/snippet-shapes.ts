import { Schema } from '@travetto/schema';

import type { SnippetSource } from './types.ts';

@Schema()
export class SnippetSourceSchema implements SnippetSource {
  sourceId!: string;
  repositoryId!: string;
  filePath!: string;
  capabilityTags!: string[];
  operationIds?: string[];
  applicability?: string[];
  notes!: string[];
}
