import { Principal } from './principal.ts';

/**
 * Definition of an authorization source, which validates a principal into an authorized principal
 *
 * @concrete ../internal/types#AuthorizerTarget
 */
export interface Authorizer<P extends Principal = Principal> {
  /**
   * Authorize inbound principal, verifying it's permission to access the system.
   * @returns New principal that conforms to the required principal shape
   */
  authorize(principal: P): Promise<P> | P;
}
