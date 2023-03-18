import { CliCommand } from '../src/decorators';
import { CliCommandRegistry, CliCommandSchema, CliCommandSchemaUtil, CliValidationError } from '../__index__';

/**
 * Generates the schema for all CLI operations
 */
@CliCommand({ hidden: true })
export class CliSchemaCommand {

  async #getSchema(name: string): Promise<CliCommandSchema> {
    const inst = await CliCommandRegistry.getInstance(name);
    return CliCommandSchemaUtil.getSchema(inst!);
  }

  async validate(name?: string): Promise<CliValidationError | undefined> {
    if (name && !CliCommandRegistry.getCommandMapping().has(name)) {
      return {
        kind: 'invalid',
        path: 'name',
        message: `${name} is not a valid cli command`
      };
    }
  }

  async main(name?: string): Promise<void> {
    if (name) {
      console.log(JSON.stringify(await this.#getSchema(name), null, 2));
    } else {
      const names = [...CliCommandRegistry.getCommandMapping().keys()];
      const schemas = await Promise.all(names.map(x => this.#getSchema(x)));
      console.log(JSON.stringify(schemas, null, 2));
    }
  }
}