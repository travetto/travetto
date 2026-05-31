import * as vscode from 'vscode';

import { RuntimeIndex } from '@travetto/runtime';

import { Activatible } from '../../core/activation.ts';
import { Workspace } from '../../core/workspace.ts';

import { BaseFeature } from '../base.ts';

const MCP_PROVIDER_ID = 'travetto-plugin.llm-support';
const MCP_SERVER_LABEL = 'Travetto LLM Support';

@Activatible({ module: '@travetto/llm-support', command: 'llm', alwaysActivate: true })
export class LlmSupportMcpFeature extends BaseFeature {

  activate(context: vscode.ExtensionContext): void {
    if (!vscode.lm?.registerMcpServerDefinitionProvider || typeof vscode.McpStdioServerDefinition !== 'function') {
      return;
    }

    let trvEntry = RuntimeIndex.getFromImport('@travetto/runtime/bin/trv.js')?.outputFile;
    let cwd = Workspace.path;

    if (!trvEntry) {
      this.log.warn('Unable to resolve trv entry from runtime index, falling back to workspace resolution');
      trvEntry = Workspace.workspaceIndex.resolvePackageCommand('trv');
      cwd = RuntimeIndex.manifest.workspace.path;
    }

    const extensionVersion = typeof context.extension.packageJSON?.version === 'string' ?
      context.extension.packageJSON.version :
      undefined;

    const provider = vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
      provideMcpServerDefinitions: () => {
        return [
          new vscode.McpStdioServerDefinition(
            MCP_SERVER_LABEL,
            process.execPath,
            [trvEntry, 'llm:support:mcp'],
            {
              CWD: cwd
            },
            extensionVersion
          )
        ];
      },
      resolveMcpServerDefinition: server => server
    });

    context.subscriptions.push(provider);
  }
}
