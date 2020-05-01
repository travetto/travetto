/**
 * A user principal, including permissions and details, does not imply
 * authentication
 */
export interface Principal {
  id: string;
  permissions: string[];
  details: Record<string, any>;
  expires?: Date;
}

/**
 * A principal that has been authenticated by a provider
 */
export interface Identity extends Principal {
  provider: string;
}