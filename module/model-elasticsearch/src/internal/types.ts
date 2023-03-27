export interface EsSchemaConfig {
  caseSensitive?: boolean;
}

export interface EsBulkError {
  type: string;
  reason: string;
}