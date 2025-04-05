import type { WebRequest } from '../../../src/types/request.ts';
import type { WebResponse } from '../../../src/types/response.ts';
import type { WebServerHandle } from '../../../src/types/server.ts';

export interface WebServerSupport {
  init(qualifier?: symbol): Promise<WebServerHandle>;
  execute(req: WebRequest): Promise<WebResponse<Buffer>>;
}