export interface Principal {
  id: string;
  permissions: Set<string>;
  details: { [key: string]: any };
  expires?: Date;
}

export interface Identity extends Principal {
  provider: string;
}