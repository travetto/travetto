import { Response } from '../types';

declare global {
  export interface Error {
    /**
     * Provides the render implementation for sending a response
     * @param res 
     */
    render?(res: Response): void;
  }
}