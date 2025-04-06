import type { WebRequest } from '../../src/types/request.ts';
import type { WebResponse } from '../../src/types/response.ts';

export interface WebServerSupport {
  init(qualifier?: symbol): Promise<unknown>;
  execute(req: WebRequest): Promise<WebResponse>;
}