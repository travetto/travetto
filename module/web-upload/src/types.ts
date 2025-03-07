/**
 * @concrete
 */
export interface FileMap extends Record<string, File> { }

export const WebUploadSymbol: unique symbol = Symbol.for('@traveto/web:uploads');