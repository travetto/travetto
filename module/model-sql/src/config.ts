import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';

/**
 * SQL Model Config
 */
@Config('sql.model')
export class SQLModelConfig {
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
   * Auto schema creation
   */
  autoCreate = !EnvUtil.isReadonly();
  /**
   * Db version
   */
  version = '';
  /**
   * Raw client options
   */
  options = {};
}