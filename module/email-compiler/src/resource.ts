import { FileQueryProvider } from '@travetto/base';

/**
 * Resource management for email templating
 */
export class EmailCompilerResource extends FileQueryProvider {
  constructor(paths: string[] = []) {
    super({ paths: [...paths, '@travetto/email-compiler#support/resources'], includeCommon: true });
  }
}