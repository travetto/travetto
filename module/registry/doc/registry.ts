import { Class } from '@travetto/runtime';
import { MetadataRegistry } from '@travetto/registry';

interface Group {
  class: Class;
  name: string;
}

interface Child {
  name: string;
  method: Function;
}

function isComplete(o: Partial<Group>): o is Group {
  return !!o;
}

export class SampleRegistry extends MetadataRegistry<Group, Child> {
  /**
   * Finalize class after all metadata is collected
   */
  onInstallFinalize<T>(cls: Class<T>): Group {
    const pending: Partial<Group> = this.getOrCreatePending(cls);
    if (isComplete(pending)) {
      return pending;
    } else {
      throw new Error('Invalid Group');
    }
  }

  /**
   * Create scaffolding on first encounter of a class
   */
  createPending(cls: Class): Partial<Group> {
    return {
      class: cls,
      name: cls.name
    };
  }
}