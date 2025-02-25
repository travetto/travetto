import { Class, ClassInstance, Env, Runtime, RuntimeIndex, describeFunction } from '@travetto/runtime';
import { FieldConfig, SchemaRegistry } from '@travetto/schema';

import { CliCommandShape, CliCommandShapeFields } from './types';
import { CliCommandRegistry } from './registry';
import { CliModuleUtil } from './module';
import { CliParseUtil } from './parse';
import { CliUtil } from './util';

type Cmd = CliCommandShape & { env?: string };

type CliCommandConfigOptions = {
  hidden?: boolean;
  runTarget?: boolean;
  runtimeModule?: 'current' | 'command';
  with?: {
    /** Application environment */
    env?: boolean;
    /** Module to run for */
    module?: boolean;
    /** Should debug invocation trigger via ipc */
    debugIpc?: boolean;
    /** Should the invocation automatically restart on exit */
    canRestart?: boolean;
  };
};

const FIELD_CONFIG: {
  name: keyof Exclude<CliCommandConfigOptions['with'], undefined>;
  field: Partial<FieldConfig>;
  run: (cmd: Cmd) => (Promise<unknown> | unknown);
}[] =
  [
    {
      name: 'env',
      run: cmd => Env.TRV_ENV.set(cmd.env || Runtime.env),
      field: {
        type: String,
        aliases: ['e', CliParseUtil.toEnvField(Env.TRV_ENV.key)],
        description: 'Application environment',
        required: { active: false },
      },
    },
    {
      name: 'module',
      run: (): void => { },
      field: {
        type: String,
        aliases: ['m', CliParseUtil.toEnvField(Env.TRV_MODULE.key)],
        description: 'Module to run for',
        specifiers: ['module'],
        required: { active: Runtime.monoRoot },
      },
    },
    {
      name: 'debugIpc',
      run: cmd => CliUtil.debugIfIpc(cmd).then((v) => v && process.exit(0)),
      field: {
        type: Boolean,
        aliases: ['di'],
        description: 'Should debug invocation trigger via ipc',
        default: true,
        required: { active: false },
      },
    },
    {
      name: 'canRestart',
      run: cmd => CliUtil.runWithRestart(cmd)?.then((v) => v && process.exit(0)),
      field: {
        type: Boolean,
        aliases: ['cr'],
        description: 'Should the invocation automatically restart on exit',
        default: false,
        required: { active: false },
      },
    }
  ];

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand(cfg: CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    if (!target.Ⲑid || describeFunction(target)?.abstract) {
      return;
    }

    const VALID_FIELDS = FIELD_CONFIG.filter(f => !!cfg.with?.[f.name]);

    const { commandModule } = CliCommandRegistry.registerClass(target, {
      hidden: cfg.hidden,
      runTarget: cfg.runTarget,
      preMain: async (cmd: Cmd) => {
        for (const field of VALID_FIELDS) {
          await field.run(cmd);
        }
      }
    });

    const pendingCls = SchemaRegistry.getOrCreatePending(target);

    for (const { name, field: { type, ...field } } of VALID_FIELDS) {
      SchemaRegistry.registerPendingFieldConfig(target, name, type!, field);
    }

    const runtimeModule = cfg.runtimeModule ?? (cfg.with?.module ? 'current' : undefined);

    if (runtimeModule) { // Validate module
      (pendingCls.validators ??= []).push(async ({ module: mod }: Partial<CliCommandShapeFields>) => {
        const runModule = (runtimeModule === 'command' ? commandModule : mod) || Runtime.main.name;

        // If we need to run as a specific module
        if (runModule !== Runtime.main.name) {
          try {
            RuntimeIndex.reinitForModule(runModule);
          } catch {
            return { source: 'flag', message: `${runModule} is an unknown module`, kind: 'custom', path: '.' };
          }
        }

        if (!(await CliModuleUtil.moduleHasDependency(runModule, commandModule))) {
          return { source: 'flag', message: `${runModule} does not have ${commandModule} as a dependency`, kind: 'custom', path: '.' };
        }
      });
    }
  };
}

/**
 * Decorator to register a CLI command flag
 */
export function CliFlag(cfg: { name?: string, short?: string, desc?: string, fileExtensions?: string[], envVars?: string[] }) {
  return function (target: ClassInstance, prop: string | symbol): void {
    const aliases: string[] = [];
    if (cfg.name) {
      aliases.push(cfg.name.startsWith('-') ? cfg.name : `--${cfg.name}`);
    }
    if (cfg.short) {
      aliases.push(cfg.short.startsWith('-') ? cfg.short : `-${cfg.short}`);
    }
    if (cfg.envVars) {
      aliases.push(...cfg.envVars.map(CliParseUtil.toEnvField));
    }
    if (typeof prop === 'string') {
      SchemaRegistry.registerPendingFieldFacet(target.constructor, prop, {
        aliases, description: cfg.desc,
        specifiers: cfg.fileExtensions?.length ? ['file', ...cfg.fileExtensions.map(x => `ext:${x.replace(/[*.]/g, '')}`)] : undefined
      });
    }
  };
}