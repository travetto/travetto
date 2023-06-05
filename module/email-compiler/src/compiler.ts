import { MessageCompiled } from '@travetto/email';

import { EmailCompilerResource } from './resource';
import { EmailCompilerUtil } from './util';

/**
 * Utilities for templating
 */
export class EmailCompiler {

  resources: EmailCompilerResource;

  constructor(resources: EmailCompilerResource) {
    this.resources = resources;
  }

  /**
   * Compile all
   */
  async compileAll(persist = false): Promise<MessageCompiled[]> {
    const keys = EmailCompilerUtil.findAllTemplates();
    return Promise.all(keys.map(src => this.compile(src, persist)));
  }

  /**
   * Compile template
   */
  async compile(src: string, persist = false): Promise<MessageCompiled> {
    return await EmailCompilerUtil.compile(src, this.resources, persist);
  }
}