import { Config } from '@travetto/config';
import { SQLModelConfig } from '@travetto/model-sql';

/**
 * PostgreSQL Model Configuration
 */
@Config('model.postgres')
export class PostgresModelConfig extends SQLModelConfig {}
