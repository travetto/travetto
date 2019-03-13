export interface Principal {
  id: string;
  permissions: Set<string>;
  details: { [key: string]: any };
  expires?: Date;
}

export interface Identity extends Principal {
  provider: string;
}

export interface AuthContext<
  P extends Principal = Principal,
  I extends Identity = Identity> {
  identity: I;
  principal: P;
}