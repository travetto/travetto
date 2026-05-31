import * as vscode from 'vscode';

import { Activatible } from '../../core/activation.ts';
import { Workspace } from '../../core/workspace.ts';

import { BaseFeature } from '../base.ts';

const MCP_PROVIDER_ID = 'travetto-plugin.llm-support';
const MCP_SERVER_LABEL = 'Travetto LLM Support';

@Activatible('@travetto/llm-support', true, 50)
export class LlmSupportMcpFeature extends BaseFeature {

  activate(context: vscode.ExtensionContext): void {
    if (!vscode.lm?.registerMcpServerDefinitionProvider || typeof vscode.McpStdioServerDefinition !== 'function') {
      this.log.warn('MCP server definition providers are not supported in this VS Code build.');
      return;
    }

    const extensionVersion = typeof context.extension.packageJSON?.version === 'string' ?
      context.extension.packageJSON.version :
      undefined;

    const provider = vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
      provideMcpServerDefinitions: () => {
        try {
          const trvEntry = Workspace.workspaceIndex.resolvePackageCommand('trv');
          return [
            new vscode.McpStdioServerDefinition(
              MCP_SERVER_LABEL,
              process.execPath,
              [trvEntry, 'llm:support:mcp'],
              undefined,
              extensionVersion
            )
          ];
        } catch (err) {
          this.log.warn('Unable to resolve workspace trv command for MCP provider', err);
          return [];
        }
      },
      resolveMcpServerDefinition: server => server
    });

    context.subscriptions.push(provider);
  }
}
