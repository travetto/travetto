import { Config } from '@travetto/config';
import { asFull } from '@travetto/runtime';

/**
 * SQL Model Config
 */
@Config('model.sql')
export class SQLModelConfig<T extends {} = {}> {
  /**
   * Host to connect to
   */
  host = '127.0.0.1';
  /**
   * Default port
   */
  port = 0;
  /**
   * Username
   */
  user = '';
  /**
   * Password
   */
  password = '';
  /**
   * Table prefix
   */
  namespace = '';
  /**
   * Database name
   */
  database = 'app';
  /**
   * Allow storage modification at runtime
   */
  modifyStorage?: boolean;
  /**
   * Db version
   */
  version = '';
  /**
   * Raw client options
   */
  options: T = asFull({});
}