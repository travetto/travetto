import { Class, MetadataRegistry } from '@travetto/registry';

interface Group {
  class: Class;
  name: string;
}

interface Child {
  name: string;
  method: Function;
}

export class SampleRegistry extends MetadataRegistry<Group, Child> {
  /**
   * Finalize class after all metadata is collected
   */
  onInstallFinalize<T>(cls: Class<T>): Group {
    return this.getOrCreatePending(cls) as Group;
  }

  /**
   * Create scaffolding on first encounter of a class
   */
  createPending(cls: Class<any>): Partial<Group> {
    return {
      class: cls,
      name: cls.name
    };
  }
}