import { ControllerConfig, EndpointConfig } from '../registry/types.ts';
import { WebFilter } from './filter.ts';

/**
 * Defines the shape for a web dispatcher
 * @concrete
 */
export interface WebDispatcher {
  /**
   * Dispatch a request, and return a promise when completed
   */
  dispatch: WebFilter;
}

/**
 * Web router pattern
 */
export interface WebRouter extends WebDispatcher {
  /**
   * Register a controller with the prepared endpoints
   */
  register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<void>;
}