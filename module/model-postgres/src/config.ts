import { Config } from '@travetto/schema';
import { SQLModelConfig } from '@travetto/model-sql';

/**
 * PostgreSQL Model Configuration
 */
@Config('model.postgres')
export class PostgresModelConfig extends SQLModelConfig {
}
