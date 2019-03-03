export interface Principal {
  id: string;
  permissions: Set<string>;
  details: { [key: string]: any };
}

export interface Identity extends Principal {
  provider: string;
  expires?: Date;
}

export interface AuthContext<
  P extends Principal = Principal,
  I extends Identity = Identity> {
  identity: Identity;
  principal?: Principal;
}