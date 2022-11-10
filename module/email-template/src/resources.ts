import { FileResourceProvider } from '@travetto/base';

class $EmailResources extends FileResourceProvider {
  pathFolder = 'email';
}

export const EmailResources = new $EmailResources();