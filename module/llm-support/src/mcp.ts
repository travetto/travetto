import { Schema } from '@travetto/schema';

import { getLlmSupportToolDefinitions, runLlmSupportTool, type LlmSupportToolName } from './tooling.ts';

@Schema()
export class JsonRpcRequestSchema {
  jsonrpc?: '2.0';

  id?: string | number | null;

  method: string;

  params?: unknown;
}

@Schema()
export class JsonRpcErrorSchema {
  code = 0;
  message = '';

  data?: unknown;
}

@Schema()
export class JsonRpcResponseSchema {
  jsonrpc: '2.0';
  id: string | number | null;

  result?: unknown;

  error?: JsonRpcErrorSchema;
}

@Schema()
export class McpInitializeCapabilitiesSchema {
  tools?: object;
}

@Schema()
export class McpInitializeServerInfoSchema {
  name?: string;
  version?: string;
}

@Schema()
export class McpInitializeResultSchema {
  protocolVersion?: string;
  capabilities?: McpInitializeCapabilitiesSchema;
  serverInfo?: McpInitializeServerInfoSchema;
}

@Schema()
export class McpToolDefinitionSchema {
  name = '';
  description = '';
  inputSchema?: object;
}

@Schema()
export class McpToolsListResultSchema {
  tools: McpToolDefinitionSchema[] = [];
}

@Schema()
export class McpToolCallContentSchema {
  type = '';
  text = '';
}

@Schema()
export class McpToolCallResultSchema {
  content: McpToolCallContentSchema[] = [];
  structuredContent?: unknown;
}

export type JsonRpcRequest = InstanceType<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = InstanceType<typeof JsonRpcResponseSchema>;

const PROTOCOL_VERSION = '2024-11-05';

function toError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  };
}

function toResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value));
}

function toToolName(value: unknown): LlmSupportToolName | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value === 'llm_support_recommend' || value === 'llm_support_plan' || value === 'llm_support_execute') {
    return value;
  }
  return undefined;
}

export async function handleMcpRequest(input: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
  const id = input.id ?? null;

  switch (input.method) {
    case 'initialize':
      return toResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: '@travetto/llm-support',
          version: '1.0.0'
        }
      });

    case 'notifications/initialized':
      return undefined;

    case 'tools/list':
      return toResult(id, {
        tools: getLlmSupportToolDefinitions()
      });

    case 'tools/call': {
      const params = asObject(input.params);
      const name = toToolName(params.name);
      if (!name) {
        return toError(id, -32602, 'Invalid tool name', { name: params.name });
      }
      try {
        const args = asObject(params.arguments);
        const output = await runLlmSupportTool(name, args);
        return toResult(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2)
            }
          ],
          structuredContent: output
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Tool execution failed';
        return toError(id, -32000, message);
      }
    }

    default:
      return toError(id, -32601, `Method not found: ${input.method}`);
  }
}
