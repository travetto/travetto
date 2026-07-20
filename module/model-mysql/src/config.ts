import { Config } from '@travetto/config';
import { SQLModelConfig } from '@travetto/model-sql';

/**
 * MySQL Model Configuration
 */
@Config('model.mysql')
export class MysqlModelConfig extends SQLModelConfig {}
