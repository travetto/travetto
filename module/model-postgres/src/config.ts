import { SQLModelConfig } from '@travetto/model-sql';
import { Config } from '@travetto/schema';

/**
 * PostgreSQL Model Configuration
 */
@Config('model.postgres')
export class PostgresModelConfig extends SQLModelConfig {}
