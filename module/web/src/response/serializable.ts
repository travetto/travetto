import { HttpPayload } from '../types.ts';

/**
 * Custom serialization contract
 */
export interface HttpSerializable<V = unknown> {
  /**
   * Serialize the output given a response.
   */
  serialize(): HttpPayload<V>;
}