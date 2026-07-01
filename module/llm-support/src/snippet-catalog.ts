import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { SchemaValidator } from '@travetto/schema';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

import { type RecommendationQuery, type SnippetSource, SnippetSourceSchema } from './types.ts';

function snippetDirectory(): string {
  const mod = RuntimeIndex.getModule('@travetto/llm-support')!;
  const generated = path.resolve(mod.sourcePath, 'generated', 'snippets');
  if (fsSync.existsSync(generated)) {
    return generated;
  }
  return path.resolve(mod.sourcePath, 'resources', 'snippets');
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function loadSnippet(fullPath: string): Promise<SnippetSource> {
  const content = await fs.readFile(fullPath, 'utf8');
  const match = content.match(/<!--\s*json\s*([\s\S]*?)\s*-->/i);
  if (!match) {
    throw new Error(`Invalid snippet markdown: ${fullPath}`);
  }
  const bound = SnippetSourceSchema.from(JSONUtil.fromUTF8(match[1].trim()));
  await SchemaValidator.validate(SnippetSourceSchema, bound);
  return bound;
}

async function loadSnippets(): Promise<SnippetSource[]> {
  try {
    const dir = snippetDirectory();
    const files = await fs.readdir(dir);
    const filtered = files
      .filter(file => file.endsWith('.md'))
      .sort();
    return Promise.all(filtered.map(file => loadSnippet(path.join(dir, file))));
  } catch (err) {
    if (isErrnoException(err) && (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND')) {
      return [];
    }
    throw err;
  }
}

let snippetsPromise: Promise<SnippetSource[]> | undefined;

async function getSnippets(): Promise<SnippetSource[]> {
  snippetsPromise ??= loadSnippets();
  return snippetsPromise;
}

function matchesAny(value: string[], desired?: string[]): boolean {
  if (!desired || desired.length === 0) {
    return true;
  }
  const wanted = new Set(desired);
  return value.some(item => wanted.has(item));
}

export async function recommendSnippets(query: RecommendationQuery = {}): Promise<SnippetSource[]> {
  const snippets = await getSnippets();
  const byOperation = query.operations && query.operations.length > 0 ?
    snippets.filter(item => matchesAny(item.operationIds ?? [], query.operations)) :
    snippets;

  const byTag = query.snippetTags && query.snippetTags.length > 0 ?
    byOperation.filter(item => matchesAny(item.capabilityTags, query.snippetTags)) :
    byOperation;

  return byTag;
}

export async function getValidSnippetTags(): Promise<string[]> {
  const snippets = await getSnippets();
  return [...new Set(snippets.flatMap(item => item.capabilityTags))].sort();
}

export const LLM_SNIPPET_SOURCES = getSnippets();
