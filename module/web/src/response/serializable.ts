import { HttpResponse } from '../types.ts';

/**
 * Custom serialization contract
 */
export interface HttpSerializable {
  /**
   * Serialize the output given a response.
   * @param res
   */
  serialize(res: HttpResponse): void | Promise<void>;
}