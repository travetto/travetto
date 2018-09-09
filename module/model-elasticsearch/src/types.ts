export interface EsBulkError {
  type: string;
  reason: string;
}

interface ESBulkItemPayload {
  _id: string;
  status: 201 | 400 | 409 | 404 | 200;
  result: 'created' | 'updated' | 'deleted' | 'not_found';
  error?: EsBulkError;
}

interface EsBulkItems {
  index?: ESBulkItemPayload;
  update?: ESBulkItemPayload;
  delete?: ESBulkItemPayload;
}

export interface EsBulkResponse {
  errors: boolean;
  items: EsBulkItems[];
}

export interface EsIdentity {
  index: string;
  type: string;
}