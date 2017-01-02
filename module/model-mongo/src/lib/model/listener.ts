export interface ChangeListener {
  onChange(change: ChangeEvent): Promise<void>;
}

export interface MongoOp {
  ts: Date;
  t: number;
  h: number;
  v: number;
  op: 'n' | 'i' | 'd';
  ns: string;
  o: any;
}

export interface ChangeEvent {
  timestamp: Date;
  version: number;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  document: any;
}