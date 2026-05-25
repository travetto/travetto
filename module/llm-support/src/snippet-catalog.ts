import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SchemaValidator } from '@travetto/schema';

import type { RecommendationQuery, SnippetSource } from './types.ts';
import { SnippetSourceSchema } from './snippet-shapes.ts';

const SNIPPET_DIR = fileURLToPath(new URL('../resources/snippets/', import.meta.url));
const WORKSPACE_SNIPPET_DIR = path.resolve(process.cwd(), 'module/llm-support/resources/snippets');

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function loadSnippet(fullPath: string): Promise<SnippetSource> {
  const content = await fs.readFile(fullPath, 'utf8');
  const match = content.match(/<!--\s*json\s*([\s\S]*?)\s*-->/i);
  if (!match) {
    throw new Error(`Invalid snippet markdown: ${fullPath}`);
  }
  const bound = SnippetSourceSchema.from(JSON.parse(match[1].trim()));
  await SchemaValidator.validate(SnippetSourceSchema, bound);
  return bound;
}

async function loadSnippets(): Promise<SnippetSource[]> {
  for (const dir of [SNIPPET_DIR, WORKSPACE_SNIPPET_DIR]) {
    try {
      const files = await fs.readdir(dir);
      const filtered = files
        .filter(file => file.endsWith('.md'))
        .sort();
      return Promise.all(filtered.map(file => loadSnippet(path.join(dir, file))));
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }

  return [];
}

const SNIPPETS: SnippetSource[] = await loadSnippets();

function matchesAny(value: string[], desired?: string[]): boolean {
  if (!desired || desired.length === 0) {
    return true;
  }
  const wanted = new Set(desired);
  return value.some(item => wanted.has(item));
}

export function recommendSnippets(query: RecommendationQuery = {}): SnippetSource[] {
  const byOperation = query.operations && query.operations.length > 0 ?
    SNIPPETS.filter(item => matchesAny(item.operationIds ?? [], query.operations)) :
    SNIPPETS;

  const byTag = query.snippetTags && query.snippetTags.length > 0 ?
    byOperation.filter(item => matchesAny(item.capabilityTags, query.snippetTags)) :
    byOperation;

  return byTag;
}

export const LLM_SNIPPET_SOURCES = SNIPPETS;
