import { DEPENDENCY_GRAPH, INSTALL_BUNDLES } from './install-guidance.ts';
import { WORKFLOWS } from './workflow-guidance.ts';
import type { AdapterNeed, DependencyGraphNode, InstallGuidance, WorkflowGuidance } from './types.ts';

const VALID_ADAPTER_NEEDS = ['blob', 'query', 'indexed', 'expiry'] as const;

const NON_SQL_ADAPTER_CAPABILITIES: Record<string, AdapterNeed[]> = {
  '@travetto/model-memory': ['blob', 'query', 'indexed', 'expiry'],
  '@travetto/model-mongo': ['blob', 'query', 'indexed', 'expiry'],
  '@travetto/model-dynamodb': ['indexed', 'expiry'],
  '@travetto/model-file': ['blob', 'expiry'],
  '@travetto/model-firestore': ['indexed'],
  '@travetto/model-redis': ['indexed', 'expiry'],
  '@travetto/model-s3': ['blob', 'expiry'],
  '@travetto/model-elasticsearch': ['query', 'indexed', 'expiry']
};

const BUNDLE_ALIASES: Record<string, string> = {
  'model-sql-stack': 'model-persistence-stack',
  'model-non-sql-stack': 'model-persistence-stack'
};

export interface RecommendationRequest {
  workflow?: string;
  bundle?: string;
  intent?: string;
  needs?: string[];
}

export interface RecommendationOutput {
  workflows: WorkflowGuidance[];
  bundles: InstallGuidance[];
  selectedNeeds: AdapterNeed[];
  recommendedAdapters: string[];
  required: string[];
  optional: string[];
  commandDiscoveryRules: string[];
  verification: string[];
}

export const RECOMMENDATION_SCHEMA_VERSION = '1.0' as const;

export interface RecommendationJsonV1 {
  schemaVersion: typeof RECOMMENDATION_SCHEMA_VERSION;
  data: RecommendationOutput;
}

const findByIntent = (intent: string): WorkflowGuidance[] => {
  const search = intent.toLowerCase();
  return WORKFLOWS.filter(workflow =>
    workflow.id.toLowerCase().includes(search) ||
    workflow.title.toLowerCase().includes(search) ||
    workflow.intent.toLowerCase().includes(search)
  );
};

const normalizeNeeds = (input?: string[]): AdapterNeed[] => {
  const all = (input ?? [])
    .flatMap(item => item.split(','))
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  for (const need of all) {
    if (!VALID_ADAPTER_NEEDS.includes(need as AdapterNeed)) {
      throw new Error(`Unknown adapter need: ${need}. Valid needs: ${VALID_ADAPTER_NEEDS.join(', ')}`);
    }
  }

  return [...new Set(all)] as AdapterNeed[];
};

const resolveDependencies = (input: Iterable<string>): Set<string> => {
  const graph = new Map<string, DependencyGraphNode>(DEPENDENCY_GRAPH.map(node => [node.package, node]));
  const out = new Set<string>();
  const queue = [...input];

  while (queue.length) {
    const current = queue.shift()!;
    if (out.has(current)) {
      continue;
    }
    out.add(current);
    const node = graph.get(current);
    if (!node) {
      continue;
    }
    for (const req of node.requires) {
      if (!out.has(req)) {
        queue.push(req);
      }
    }
  }

  return out;
};

export const renderRecommendationText = (result: RecommendationOutput): string => {
  const lines: string[] = [];

  lines.push('llm-support recommendation');

  if (result.workflows.length) {
    lines.push('');
    lines.push('workflows:');
    for (const workflow of result.workflows) {
      lines.push(`- ${workflow.id}: ${workflow.title}`);
    }
  }

  if (result.bundles.length) {
    lines.push('');
    lines.push('bundles:');
    for (const bundle of result.bundles) {
      lines.push(`- ${bundle.id}: ${bundle.title}`);
    }
  }

  lines.push('');
  lines.push('required:');
  for (const pkg of result.required) {
    lines.push(`- ${pkg}`);
  }

  lines.push('');
  lines.push('optional:');
  for (const pkg of result.optional) {
    lines.push(`- ${pkg}`);
  }

  if (result.commandDiscoveryRules.length) {
    lines.push('');
    lines.push('command-discovery-rules:');
    for (const rule of result.commandDiscoveryRules) {
      lines.push(`- ${rule}`);
    }
  }

  if (result.verification.length) {
    lines.push('');
    lines.push('verification:');
    for (const check of result.verification) {
      lines.push(`- ${check}`);
    }
  }

  if (result.selectedNeeds.length) {
    lines.push('');
    lines.push('selected-needs:');
    for (const need of result.selectedNeeds) {
      lines.push(`- ${need}`);
    }

    lines.push('');
    lines.push('recommended-adapters:');
    for (const adapter of result.recommendedAdapters) {
      lines.push(`- ${adapter}`);
    }
  }

  return lines.join('\n');
};

export const resolveRecommendation = (request: RecommendationRequest): RecommendationOutput => {
  const selectedWorkflows: WorkflowGuidance[] = [];
  const selectedBundles: InstallGuidance[] = [];
  const requiredDirect = new Set<string>();
  const optional = new Set<string>();
  const commandDiscoveryRules = new Set<string>();
  const verification = new Set<string>();
  const selectedNeeds = normalizeNeeds(request.needs);

  if (request.workflow) {
    const workflow = WORKFLOWS.find(item => item.id === request.workflow);
    if (!workflow) {
      throw new Error(`Unknown workflow id: ${request.workflow}`);
    }
    selectedWorkflows.push(workflow);
  }

  if (request.bundle) {
    const normalizedBundle = BUNDLE_ALIASES[request.bundle] ?? request.bundle;
    const bundle = INSTALL_BUNDLES.find(item => item.id === normalizedBundle);
    if (!bundle) {
      throw new Error(`Unknown install bundle id: ${request.bundle}`);
    }
    selectedBundles.push(bundle);

    if (normalizedBundle !== request.bundle) {
      verification.add(`Bundle '${request.bundle}' is deprecated, using '${normalizedBundle}'`);
    }
  }

  if (request.intent) {
    const matches = findByIntent(request.intent);
    if (!matches.length) {
      throw new Error(`No workflows match intent: ${request.intent}`);
    }
    for (const workflow of matches) {
      if (!selectedWorkflows.some(item => item.id === workflow.id)) {
        selectedWorkflows.push(workflow);
      }
    }
  }

  if (!selectedWorkflows.length && !selectedBundles.length) {
    selectedWorkflows.push(...WORKFLOWS);
    selectedBundles.push(...INSTALL_BUNDLES);
  }

  for (const workflow of selectedWorkflows) {
    workflow.recommendedModules.forEach(pkg => requiredDirect.add(pkg));
    workflow.optionalModules.forEach(pkg => optional.add(pkg));
    commandDiscoveryRules.add(workflow.commandDiscoveryRule);
    workflow.verification.forEach(check => verification.add(check));
  }

  for (const bundle of selectedBundles) {
    bundle.required.forEach(pkg => requiredDirect.add(pkg));
    bundle.optional.forEach(pkg => optional.add(pkg));
    bundle.notes.forEach(note => verification.add(note));
  }

  const required = resolveDependencies(requiredDirect);
  for (const pkg of required) {
    optional.delete(pkg);
  }

  const recommendedAdapters = selectedNeeds.length ?
    Object.entries(NON_SQL_ADAPTER_CAPABILITIES)
      .filter(([, supported]) => selectedNeeds.every(need => supported.includes(need)))
      .map(([pkg]) => pkg)
      .toSorted() :
    [];

  if (selectedNeeds.length) {
    for (const pkg of Object.keys(NON_SQL_ADAPTER_CAPABILITIES)) {
      optional.delete(pkg);
    }

    for (const pkg of recommendedAdapters) {
      if (!required.has(pkg)) {
        optional.add(pkg);
      }
    }

    if (recommendedAdapters.length) {
      verification.add(`Select one non-SQL adapter from capability matches: ${recommendedAdapters.join(', ')}`);
    } else {
      verification.add(`No single non-SQL adapter satisfies all needs: ${selectedNeeds.join(', ')}`);
    }
  }

  return {
    workflows: selectedWorkflows,
    bundles: selectedBundles,
    selectedNeeds,
    recommendedAdapters,
    required: [...required].toSorted(),
    optional: [...optional].toSorted(),
    commandDiscoveryRules: [...commandDiscoveryRules],
    verification: [...verification]
  };
};

export const resolveRecommendationJsonV1 = (request: RecommendationRequest): RecommendationJsonV1 => ({
  schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
  data: resolveRecommendation(request)
});