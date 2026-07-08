export const CONSUMER_LLM_DOCS = {
  compatibilityNotes: [
    {
      version: '1.0',
      transport: 'json-rpc-2.0-stdio',
      supportedMethods: ['initialize', 'notifications/initialized', 'tools/list', 'tools/call'],
      notes: ['Tool names are stable: llm_support_recommend, llm_support_plan, llm_support_execute.', 'Execution defaults to dry-run unless apply is true.'],
    },
  ],
  helperFlows: [
    {
      id: 'recommend-plan-execute',
      helper: 'runLlmSupportFlow',
      description: 'Single-call helper to run recommendation, planning, and execution with optional overrides.',
    },
  ],
} as const;

export const CONSUMER_LLM_DOC_COUNT = CONSUMER_LLM_DOCS.compatibilityNotes.length + CONSUMER_LLM_DOCS.helperFlows.length;
