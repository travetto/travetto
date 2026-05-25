import fs from 'node:fs/promises';
import path from 'node:path';

import mustache from 'mustache';

import type { TransactionalEmailContext } from './schema.ts';

export async function render{{renderName}}Email(ctx: TransactionalEmailContext): Promise<string> {
  const tplPath = path.resolve(process.cwd(), 'src/email/templates/{{emailName}}.mustache');
  const tpl = await fs.readFile(tplPath, 'utf8');
  return mustache.render(tpl, ctx);
}
