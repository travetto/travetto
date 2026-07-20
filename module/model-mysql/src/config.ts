import { Config } from '@travetto/schema';
import { SQLModelConfig } from '@travetto/model-sql';

/**
 * MySQL Model Configuration
 */
@Config('model.mysql')
export class MysqlModelConfig extends SQLModelConfig {
}
