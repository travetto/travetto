import { Config } from '@encore/config';

@Config('context')
export class ContextConfig {
  longStackTraces = false;
  namespace = 'encore';
}