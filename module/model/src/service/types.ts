/**
 * Model UUID Generator
 */
export type ModelUuidGenerator = (() => string) & { valid: (id: string) => boolean };
