import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

type VerifyFailure = {
  check: string;
  message: string;
};

const REQUIRED_FILES = [
  'module/llm-support/llm/consumer/OVERVIEW.md',
  'module/llm-support/llm/consumer/INSTRUCTIONS.md',
  'module/llm-support/llm/consumer/TIPS.md',
  'module/llm-support/src/consumer-docs.ts'
];

const REQUIRED_OVERVIEW_HEADINGS = [
  '## What This Module Is',
  '## Why To Use It',
  '## When To Use It',
  '## When Not To Use It',
  '## Core Capabilities',
  '## Decorators',
  '## Utility Classes (Non-Internal)',
  '## Core APIs and Extension Points',
  '## Typical Integration Flow',
  '## Practical Scenario'
];

const STALE_SYMBOL_PATTERNS = [
  'RuntimeIndex',
  'SchemaRegistry.bind',
  'DependencyRegistry'
];

@CliCommand()
export class LlmSupportVerifyCommand implements CliCommandShape {

  private async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(Runtime.workspaceRelative(relPath));
      return true;
    } catch {
      return false;
    }
  }

  private async read(relPath: string): Promise<string> {
    return fs.readFile(Runtime.workspaceRelative(relPath), 'utf8');
  }

  private async verifyStructure(): Promise<VerifyFailure[]> {
    const failures: VerifyFailure[] = [];
    for (const file of REQUIRED_FILES) {
      if (!(await this.exists(file))) {
        failures.push({ check: 'structure', message: `Missing required file: ${file}` });
      }
    }
    return failures;
  }

  private async verifyOverviewContract(): Promise<VerifyFailure[]> {
    const failures: VerifyFailure[] = [];
    const content = await this.read('module/llm-support/llm/consumer/OVERVIEW.md');
    for (const heading of REQUIRED_OVERVIEW_HEADINGS) {
      if (!content.includes(heading)) {
        failures.push({ check: 'consumer-contract', message: `Missing required heading: ${heading}` });
      }
    }
    return failures;
  }

  private async verifyPublishSafety(): Promise<VerifyFailure[]> {
    const failures: VerifyFailure[] = [];
    const pkgRaw = await this.read('module/llm-support/package.json');
    const pkg = JSON.parse(pkgRaw) as { files?: string[] };
    const files = pkg.files ?? [];
    if (files.includes('llm')) {
      failures.push({ check: 'publish-safety', message: 'package.json files array must not include llm' });
    }
    return failures;
  }

  private async verifyStaleSymbols(): Promise<VerifyFailure[]> {
    const failures: VerifyFailure[] = [];
    const dir = Runtime.workspaceRelative('module/llm-support/llm');
    const queue = [dir];
    while (queue.length) {
      const current = queue.pop()!;
      for (const ent of await fs.readdir(current, { withFileTypes: true })) {
        const full = path.join(current, ent.name);
        if (ent.isDirectory()) {
          queue.push(full);
          continue;
        }
        if (!ent.name.endsWith('.md')) {
          continue;
        }
        const rel = path.relative(Runtime.workspace.path, full);
        const content = await fs.readFile(full, 'utf8');
        for (const stale of STALE_SYMBOL_PATTERNS) {
          if (content.includes(stale)) {
            failures.push({ check: 'accuracy', message: `Stale symbol pattern '${stale}' found in ${rel}` });
          }
        }
      }
    }
    return failures;
  }

  async main(): Promise<void> {
    const checks = await Promise.all([
      this.verifyStructure(),
      this.verifyOverviewContract(),
      this.verifyPublishSafety(),
      this.verifyStaleSymbols()
    ]);

    const failures = checks.flat();
    if (!failures.length) {
      console.log('llm-support verification passed');
      return;
    }

    for (const failure of failures) {
      console.error(`[${failure.check}] ${failure.message}`);
    }
    throw new Error(`llm-support verification failed with ${failures.length} issue(s)`);
  }
}
