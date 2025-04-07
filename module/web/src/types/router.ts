import { WebDispatcher } from '../types.ts';
import { ControllerConfig, EndpointConfig } from '../registry/types.ts';

/**
 * Web router pattern
 */
export interface WebRouter extends WebDispatcher {
  /**
   * Register a controller with the prepared endpoints
   */
  register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<() => void>;
}