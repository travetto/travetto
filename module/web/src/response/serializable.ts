import { HttpResponse, HttpPayload } from '../types.ts';

/**
 * Custom serialization contract
 */
export interface HttpSerializable {
  /**
   * Serialize the output given a response.  If a payload is returned, send it to the client
   * @param res
   */
  serialize(res: HttpResponse): HttpPayload | void;
}