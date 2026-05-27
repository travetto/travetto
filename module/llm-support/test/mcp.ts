import assert from 'node:assert';

import type { Any, Class } from '@travetto/runtime';
import { Schema, SchemaValidator } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { handleMcpRequest, JsonRpcResponseSchema } from '../src/mcp.ts';

async function bindAndValidate<T extends object>(schema: Class<T>, payload: unknown): Promise<T> {
  const bound = schema.from(payload as Any);
  await SchemaValidator.validate(schema, bound);
  return bound;
}

@Schema()
class InitializeCapabilitiesSchema {
  tools?: object;
}

@Schema()
class InitializeServerInfoSchema {
  name?: string;
}

@Schema()
class InitializeResultSchema {
  capabilities?: InitializeCapabilitiesSchema;

  serverInfo?: InitializeServerInfoSchema;
}

@Schema()
class ToolSummarySchema {
  name = '';
}

@Schema()
class ToolsListResultSchema {
  tools: ToolSummarySchema[] = [];
}

@Schema()
class LlmOperationResultSchema {
  category = '';
}

@Schema()
class RecommendStructuredResultSchema {
  operations: LlmOperationResultSchema[] = [];
}

@Schema()
class RecommendCallResultSchema {
  structuredContent?: RecommendStructuredResultSchema;
}

@Suite()
class LlmSupportMcpTest {

  @Test()
  async initializeRespondsWithToolCapability() {
    const output = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    });

    assert(output);
    const response = await bindAndValidate(JsonRpcResponseSchema, output);
    const result = await bindAndValidate(InitializeResultSchema, response.result);
    assert(result.capabilities?.tools);
    assert(result.serverInfo?.name === '@travetto/llm-support');
  }

  @Test()
  async listsTools() {
    const output = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    assert(output);
    const response = await bindAndValidate(JsonRpcResponseSchema, output);
    const result = await bindAndValidate(ToolsListResultSchema, response.result);
    const tools = result.tools;
    const names = tools.map(item => item.name);
    assert(names.includes('llm_support_recommend'));
    assert(names.includes('llm_support_plan'));
    assert(names.includes('llm_support_execute'));
  }

  @Test()
  async callsRecommendTool() {
    const output = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'llm_support_recommend',
        arguments: { categories: ['web'] }
      }
    });

    assert(output);
    const response = await bindAndValidate(JsonRpcResponseSchema, output);
    const result = await bindAndValidate(RecommendCallResultSchema, response.result);
    const structured = result.structuredContent;
    assert(structured?.operations?.length);
    assert(structured?.operations?.every(item => item.category === 'web'));
  }

  @Test()
  async rejectsUnknownMethod() {
    const output = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'unknown/method'
    });

    assert(output);
    const response = await bindAndValidate(JsonRpcResponseSchema, output);
    assert(response.error);
    assert(response.error?.code === -32601);
  }

  @Test()
  async mapsToolExecutionFailuresToServerError() {
    const output = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'llm_support_execute',
        arguments: {
          operations: 5,
          targetDir: '.'
        }
      }
    });

    assert(output);
    const response = await bindAndValidate(JsonRpcResponseSchema, output);
    assert(response.error);
    assert(response.error?.code === -32000);
    assert((response.error?.message ?? '').length > 0);
  }
}
