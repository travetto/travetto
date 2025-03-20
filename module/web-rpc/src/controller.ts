import { Controller, All, ConfigureInterceptor, LoggingInterceptor, Undocumented } from '@travetto/web';

import { WebRpcInterceptor } from './interceptor.ts';

/**
 * Declares endpoint functionality for RPC behavior
 */
@Controller('/rpc')
@Undocumented()
export class WebRpController {

  @All('/')
  @ConfigureInterceptor(LoggingInterceptor, { disabled: true })
  @ConfigureInterceptor(WebRpcInterceptor, { disabled: false })
  async onRequest(): Promise<void> {
    // Placeholder
  }
}