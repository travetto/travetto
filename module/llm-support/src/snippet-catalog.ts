import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSONUtil } from '@travetto/runtime';

import type { RecommendationQuery, SnippetSource } from './types.ts';

const SNIPPET_DIR = fileURLToPath(new URL('../resources/snippets/', import.meta.url));

function loadSnippet(file: string): SnippetSource {
  const fullPath = path.join(SNIPPET_DIR, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const match = content.match(/<!--\s*json\s*([\s\S]*?)\s*-->/i);
  if (!match) {
    throw new Error(`Invalid snippet markdown: ${fullPath}`);
  }
  return JSONUtil.fromUTF8(match[1].trim());
}

const SNIPPETS: SnippetSource[] = fs.existsSync(SNIPPET_DIR) ?
  fs.readdirSync(SNIPPET_DIR)
    .filter(file => file.endsWith('.md'))
    .sort()
    .map(loadSnippet) :
  [];

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
