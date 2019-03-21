export interface Principal {
  id: string;
  permissions: string[];
  details: { [key: string]: any };
  expires?: Date;
}

export interface Identity extends Principal {
  provider: string;
}