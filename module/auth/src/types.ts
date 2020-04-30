/**
 * The definition of an authentication
 * principal.
 */
export interface Principal {
  id: string;
  permissions: string[];
  details: Record<string, any>;
  expires?: Date;
}

/**
 * The identity of a user, as authenticated
 * by a provider.
 */
export interface Identity extends Principal {
  provider: string;
}