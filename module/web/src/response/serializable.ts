import { HttpResponse } from '../types';

/**
 * Renderable contract
 */
export interface HttpSerializable {
  /**
   * Serialize the output given a response.  If a value is returned, send it to the client
   * @param res
   */
  serialize(res: HttpResponse): unknown;
}