import { toConcrete } from '@travetto/runtime';
import { SchemaTypeUtil } from '@travetto/schema';

/**
 * @concrete
 */
export interface FileMap extends Record<string, File> { }

SchemaTypeUtil.setSchemaTypeConfig(toConcrete<FileMap>(), {
  validate: (input) => typeof input === 'object' && !!input && Object.values(input).every(v => v instanceof Blob) ? 'type' : undefined,
});