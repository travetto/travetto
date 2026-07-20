import { SQLModelConfig } from '@travetto/model-sql';
import { Config } from '@travetto/schema';

/**
 * MySQL Model Configuration
 */
@Config('model.mysql')
export class MysqlModelConfig extends SQLModelConfig {}
