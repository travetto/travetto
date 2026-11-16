import { isRecord, toConcrete } from '@travetto/runtime';
import { SchemaTypeUtil } from '@travetto/schema';

/**
 * @concrete
 */
export interface FileMap extends Record<string, File> {}

SchemaTypeUtil.register(toConcrete<FileMap>(), input => isRecord(input) && Object.values(input).every(v => v instanceof Blob));
