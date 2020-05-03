// TODO: Document
export interface CommandConfig {
  allowDocker: boolean;
  localCheck: (() => Promise<boolean>) | [string, string[]];
  localCommand: (args: string[]) => string[];

  containerImage: string;
  containerEntry: string;
  containerCommand: (args: string[]) => string[];
}
