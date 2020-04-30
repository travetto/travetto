// TODO: Document
export interface Principal {
  id: string;
  permissions: string[];
  details: Record<string, any>;
  expires?: Date;
}

// TODO: Document
export interface Identity extends Principal {
  provider: string;
}