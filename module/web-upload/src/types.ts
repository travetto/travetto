/**
 * @concrete
 */
export interface FileMap extends Record<string, File & { cleanup?: () => Promise<void> }> { }