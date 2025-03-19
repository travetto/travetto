import { HttpResponse } from '../types.ts';

/**
 * Custom serialization contract
 */
export interface HttpSerializable<T> {
  /**
   * Serialize the output given a response.
   * @param res
   */
  serialize(res: HttpResponse): Promise<T> | T;
}