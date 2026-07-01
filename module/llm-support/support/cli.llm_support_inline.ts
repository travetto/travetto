import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { RuntimeIndex, Runtime } from '@travetto/runtime';

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoPath(repositoryId: string): Promise<string> {
  if (repositoryId === 'travetto') {
    return Runtime.workspace.path;
  }
  const exactPath = path.resolve(Runtime.workspace.path, '..', repositoryId);
  if (await exists(exactPath)) {
    return exactPath;
  }
  const dotPath = path.resolve(Runtime.workspace.path, '..', repositoryId.replaceAll('-', '.'));
  if (await exists(dotPath)) {
    return dotPath;
  }
  throw new Error(`Could not resolve path for repository: ${repositoryId}`);
}

function getLanguage(filename: string): string {
  const ext = path.extname(filename);
  switch (ext) {
    case '.ts': case '.tsx': return 'typescript';
    case '.js': case '.jsx': return 'javascript';
    case '.json': return 'json';
    case '.yml': case '.yaml': return 'yaml';
    case '.md': return 'markdown';
    case '.sh': return 'bash';
    default: return '';
  }
}

async function readSourceContent(repoPath: string, relativePath: string): Promise<string> {
  const targetPath = path.resolve(repoPath, relativePath);
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    const content = await fs.readFile(targetPath, 'utf8');
    const lang = getLanguage(targetPath);
    return `\n## Reference Code\n\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n`;
  } else if (stat.isDirectory()) {
    const files: string[] = [];
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(full);
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
          files.push(full);
        }
      }
    }
    await scan(targetPath);
    files.sort();
    let result = '\n## Reference Code\n';
    for (const file of files) {
      const rel = path.relative(targetPath, file);
      const content = await fs.readFile(file, 'utf8');
      const lang = getLanguage(file);
      result += `\n### \`${rel}\`\n\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n`;
    }
    return result;
  }
  throw new Error(`Target path is neither a file nor a directory: ${targetPath}`);
}

/**
 * Inline and compile reference snippets for llm-support packaging.
 */
@CliCommand()
export class LlmSupportInlineCommand implements CliCommandShape {

  async main(): Promise<void> {
    const mod = RuntimeIndex.getModule('@travetto/llm-support')!;
    const sourceDir = path.resolve(mod.sourcePath, 'resources', 'snippets');
    const targetDir = path.resolve(mod.sourcePath, 'generated', 'snippets');

    console.log(`Compiling snippets from ${sourceDir} to ${targetDir}`);

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    if (!(await exists(sourceDir))) {
      console.log(`Source snippets directory does not exist: ${sourceDir}`);
      return;
    }

    const files = await fs.readdir(sourceDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const sourceFile = path.join(sourceDir, file);
      const targetFile = path.join(targetDir, file);

      const content = await fs.readFile(sourceFile, 'utf8');
      const match = content.match(/<!--\s*json\s*([\s\S]*?)\s*-->/i);
      if (!match) {
        console.warn(`Warning: snippet ${file} lacks front-matter JSON comment. Copying as-is.`);
        await fs.writeFile(targetFile, content, 'utf8');
        continue;
      }

      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(match[1].trim());
      } catch (err) {
        console.error(`Error parsing front-matter JSON in ${file}:`, err);
        throw err;
      }

      const { repositoryId, filePath } = meta;
      if (typeof repositoryId === 'string' && repositoryId && typeof filePath === 'string' && filePath) {
        try {
          const repoPath = await resolveRepoPath(repositoryId);
          const inlinedCode = await readSourceContent(repoPath, filePath);
          const newContent = `${content.trim()}\n${inlinedCode}`;
          await fs.writeFile(targetFile, newContent, 'utf8');
          console.log(`Successfully compiled and inlined ${file}`);
        } catch (err) {
          console.error(`Failed to inline source for ${file} (${repositoryId}:${filePath}):`, err);
          throw err;
        }
      } else {
        // Snippet does not reference external repo/file; copy as-is
        await fs.writeFile(targetFile, content, 'utf8');
        console.log(`Copied self-contained snippet ${file} as-is`);
      }
    }

    console.log('Finished compiling snippets.');
  }
}
