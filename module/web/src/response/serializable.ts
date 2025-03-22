import { HttpContext, HttpPayload } from '../types.ts';

/**
 * Custom serialization contract
 */
export interface HttpSerializable {
  /**
   * Serialize the output given a response.
   */
  serialize(ctx: HttpContext): HttpPayload;
}