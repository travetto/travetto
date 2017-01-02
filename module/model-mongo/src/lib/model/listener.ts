export interface ChangeListener {
  onChange(change: ChangeEvent): Promise<void>;
}

export type ChangeAction = 'update' | 'create' | 'delete';

export interface ChangePayload {
  _id: string;
  [key: string]: any;
}

export interface ChangeEvent {
  action: ChangeAction;
  collection: string;
  payload: ChangePayload;
  partial?: boolean;
};

