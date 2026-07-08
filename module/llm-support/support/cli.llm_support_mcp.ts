import { createInterface } from 'node:readline';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { JSONUtil } from '@travetto/runtime';

import { handleMcpRequest, type JsonRpcRequest } from '../src/mcp.ts';

/**
 * Minimal MCP stdio server for llm-support tools.
 */
@CliCommand()
export class LlmSupportMcpCommand implements CliCommandShape {
  async main(): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });

    const active: Promise<void>[] = [];

    const processLine = async (line: string): Promise<void> => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      let request: JsonRpcRequest;
      try {
        request = JSONUtil.fromUTF8(trimmed);
      } catch {
        const parseError = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        };
        process.stdout.write(`${JSONUtil.toUTF8(parseError)}\n`);
        return;
      }

      const response = await handleMcpRequest(request);
      if (response) {
        process.stdout.write(`${JSONUtil.toUTF8(response)}\n`);
      }
    };

    rl.on('line', line => {
      const run = processLine(line).finally(() => {
        const idx = active.indexOf(run);
        if (idx >= 0) {
          active.splice(idx, 1);
        }
      });
      active.push(run);
    });

    await new Promise<void>(resolve => rl.on('close', resolve));
    await Promise.all(active);
  }
}
