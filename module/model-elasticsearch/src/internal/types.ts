export interface EsSchemaConfig {
  caseSensitive?: boolean;
}

export interface EsBulkError {
  type: string;
  reason: string;
}

interface EsBulkItemPayload {
  _id: string;
  status: 201 | 400 | 409 | 404 | 200;
  result: 'created' | 'updated' | 'deleted' | 'not_found';
  error?: EsBulkError;
}

interface EsBulkItems {
  index?: EsBulkItemPayload;
  update?: EsBulkItemPayload;
  delete?: EsBulkItemPayload;
}

export interface EsBulkResponse {
  errors: boolean;
  items: EsBulkItems[];
}

export interface EsIdentity {
  index: string;
  type?: string;
}