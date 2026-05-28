/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader install={false} />

  The {d.module('LlmSupport')} module provides guided LLM assistance for Travetto projects. It helps you move from a target outcome to a concrete plan by combining bundle recommendations, workflow guidance, operation planning, and snippet selection.

  <c.Section title='Install'>
    In a Travetto workspace, install the module and use the standard CLI entrypoint:

    <c.Code language='bash' title='Install the module' src='npm install @travetto/llm-support' />

    The module is designed to be used through {d.module('Cli')} commands, so once the package is available you can invoke the LLM support workflow with {d.input('trv')}.
  </c.Section>

  <c.Section title='Usage'>
    The recommended flow is intentionally plan-first:

    <ol>
      <li>Run {d.input('trv llm:support:recommend')} to choose a bundle, workflow, category, or snippet set.</li>
      <li>Run {d.input('trv llm:support:plan')} to preview the files and changes that would be produced.</li>
      <li>Run {d.input('trv llm:support:execute')} to apply the selected operations, with dry-run behavior available by default.</li>
    </ol>

    <c.Code language='bash' title='Recommended flow' src='trv llm:support:recommend\ntrv llm:support:plan\ntrv llm:support:execute' />

    The recommendation command supports filtering by {d.input('bundles')}, {d.input('workflows')}, {d.input('categories')}, and {d.input('snippet-tags')}.  The plan command focuses on selected {d.input('operations')} and produces file-level change steps.  Execution supports dry-run, overwrite, target directory selection, monorepo bootstrap selection ({d.input('--monorepo')}), and several operation-specific hints such as route, controller, service, model, and email naming.
  </c.Section>

  <c.Section title='What It Supports'>
    The module covers the core assistant paths used by Travetto projects:

    <ul>
      <li><strong>Project bootstrap</strong> - guided module and backend selection for a new application.</li>
      <li><strong>Web</strong> - route, controller, service, interceptor, and client-oriented flows.</li>
      <li><strong>Auth</strong> - session-backed identity and auth-web guided setup.</li>
      <li><strong>Model</strong> - persistence, query, indexed, and backend selection guidance.</li>
      <li><strong>Upload</strong> - direct upload and presigned URL support.</li>
      <li><strong>Workflow</strong> - deployment-oriented GitHub workflow generation.</li>
      <li><strong>Quality</strong> - linting and test suite setup.</li>
      <li><strong>Email</strong> - templates, rendering, transport, preview, and send flows.</li>
      <li><strong>Test</strong> - fixture and suite generation guidance.</li>
      <li><strong>Config</strong> - configuration class and file generation.</li>
      <li><strong>Cache</strong> - cache decorators and evictions workflows.</li>
    </ul>

    The available categories exposed by the CLI are {d.input('project')}, {d.input('web')}, {d.input('auth')}, {d.input('model')}, {d.input('upload')}, {d.input('workflow')}, {d.input('quality')}, {d.input('email')}, {d.input('test')}, {d.input('config')}, and {d.input('cache')}.
  </c.Section>

  <c.Section title='Bundles And Workflows'>
    Recommendations are grouped into install guidance bundles and workflow guidance:

    <ul>
      <li>{d.input('web-api-baseline')} - web application fundamentals with DI and schema support.</li>
      <li>{d.input('web-model-crud')} - controller/service CRUD flows backed by model-query.</li>
      <li>{d.input('model-persistence-stack')} - model persistence and adapter selection.</li>
      <li>{d.input('auth-enabled-web')} - web auth with auth-web integration.</li>
      <li>{d.input('quality-lint-and-test')} - linting and test guardrails.</li>
      <li>{d.input('email-generation-stack')} - email template and delivery setup.</li>
      <li>{d.input('project-bootstrap')} - guided new-project setup.</li>
      <li>{d.input('create-web-route')} - route/controller/service generation workflow.</li>
      <li>{d.input('generate-web-model-crud')} - model-backed CRUD generation workflow.</li>
    </ul>

    The recommendation output also includes snippets that match the selected operations and capability tags, so the generated plan stays tied to reusable implementation patterns.
  </c.Section>

  <c.Section title='Command Options'>
    The CLI surface is designed for narrow, predictable selection:

    <ul>
      <li>{d.input('--module')} - scope recommendations to the active module.</li>
      <li>{d.input('--bundles')} - choose specific install guidance bundles.</li>
      <li>{d.input('--workflows')} - choose specific workflow guidance entries.</li>
      <li>{d.input('--operations')} - choose specific operations for planning.</li>
      <li>{d.input('--categories')} - filter by capability category.</li>
      <li>{d.input('--snippet-tags')} - narrow the snippet catalog.</li>
      <li>{d.input('--include-excluded')} - include excluded operations when you need the full catalog.</li>
      <li>{d.input('--monorepo')} - when used with {d.input('project-bootstrap')}, generate a workspace root and {d.input('packages/app')} project layout.</li>
      <li>{d.input('--workspace-path')} - customize the monorepo app location (for example {d.input('packages/api')}).</li>
      <li>{d.input('--workspace-name')} - customize the generated workspace package name used by root scripts.</li>
    </ul>

    That combination lets you start broad, then narrow to exactly the path you want before making changes.
  </c.Section>

  <c.Section title='MCP Integration'>
    The module exposes a minimal stdio MCP entrypoint for tool-calling integrations:

    <c.Code language='bash' title='Start MCP server' src='trv llm:support:mcp' />

    Supported methods are {d.input('initialize')}, {d.input('tools/list')}, and {d.input('tools/call')}. Requests and responses are newline-delimited JSON-RPC 2.0 payloads.

    <c.Code title='MCP request examples' language='json' src={[
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
      '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"llm_support_plan","arguments":{"operations":["create-web-route"]}}}'
    ].join('\n')} />
  </c.Section>

  <c.Section title='Contract Model'>
    Contributor contract model for this module:

    <ul>
      <li>Boundary contracts are schema classes first (inputs and outputs).</li>
      <li>Public type names are derived from classes instead of parallel interface trees.</li>
      <li>Runtime boundaries validate both inbound payloads and outbound responses.</li>
      <li>Tests should prefer schema bind+validate over custom shape guards when practical.</li>
    </ul>

    For execution and tooling helpers in this module, prefer non-assertion-safe binding where required by project rules.
  </c.Section>
</>;