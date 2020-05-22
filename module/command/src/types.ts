/**
 * Structure for defining a command to be executed.  A command can be thought of as a
 * program or operation that can be provided via a pre-installed binary or by using
 * a docker container.
 */
export interface CommandConfig {
  allowDocker: boolean;
  localCheck: (() => Promise<boolean>) | [string, string[]];
  localCommand: (args: string[]) => string[];

  containerImage: string;
  containerEntry: string;
  containerCommand: (args: string[]) => string[];
}
