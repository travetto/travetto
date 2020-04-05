import { Response } from './types';

declare global {
  export interface Error {
    render?(res: Response): void;
    type?: string;
    status?: number;
    statusCode?: number;
    toJSON?(): any;
  }
}