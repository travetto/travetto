import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

const OUTPUT_FILE = Runtime.workspaceRelative('module/llm-support/src/consumer-docs.ts');
const MODULE_DIR = Runtime.workspaceRelative('module');

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function collect(): Promise<Record<string, Record<string, string>>> {
  const modules = await fs.readdir(MODULE_DIR, { withFileTypes: true });
  const output: Record<string, Record<string, string>> = {};

  for (const moduleDir of modules.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name).sort()) {
    const consumerDir = path.join(MODULE_DIR, moduleDir, 'llm', 'consumer');
    if (!(await exists(consumerDir))) {
      continue;
    }

    const files = (await fs.readdir(consumerDir))
      .filter(name => name.endsWith('.md'))
      .sort();

    if (!files.length) {
      continue;
    }

    output[moduleDir] = {};
    for (const file of files) {
      const full = path.join(consumerDir, file);
      output[moduleDir][file.replace(/\.md$/, '')] = await fs.readFile(full, 'utf8');
    }
  }

  return output;
}

@CliCommand()
export class LlmSupportPackageConsumerDocsCommand implements CliCommandShape {
  async main(): Promise<void> {
    const docs = await collect();
    const content = `export const CONSUMER_LLM_DOCS = ${JSON.stringify(docs, null, 2)} as const;\n\nexport const CONSUMER_LLM_DOC_COUNT = ${Object.values(docs).reduce((sum, entry) => sum + Object.keys(entry).length, 0)};\n`;

    await fs.writeFile(OUTPUT_FILE, content, 'utf8');
    console.log(`Wrote ${OUTPUT_FILE}`);
  }
}
