import { asFull, Runtime } from '@travetto/runtime';

/**
 * Base configuration class for SQL/JSON document model services
 */
export class SQLModelConfig<ClientOptions extends {} = {}> {
  /**
   * Database host to connect to
   */
  host = '127.0.0.1';

  /**
   * Database port to connect to
   */
  port = 0;

  /**
   * Database username
   */
  user = Runtime.production ? '' : 'travetto';

  /**
   * Database password
   */
  password = Runtime.production ? '' : 'travetto';

  /**
   * Namespace/schema prefix for table names
   */
  namespace = '';

  /**
   * Database name
   */
  database = 'app';

  /**
   * Allow storage modifications (like table auto-creation and schema updates) at runtime
   */
  modifyStorage = !Runtime.production;

  /**
   * Extra raw database client options
   */
  options: ClientOptions = asFull({});
}
