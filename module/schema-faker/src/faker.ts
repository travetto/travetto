import { faker } from '@faker-js/faker';

import { castTo, type Class, TimeUtil } from '@travetto/runtime';
import { BindUtil, type SchemaFieldConfig, CommonRegex, SchemaRegistryIndex } from '@travetto/schema';

/**
 * Provide a faker utility for generating content
 */
export class SchemaFaker {

  static #stringToReType = new Map<RegExp, () => string>([
    [CommonRegex.email, faker.internet.email],
    [CommonRegex.url, faker.internet.url],
    [CommonRegex.telephone, faker.phone.number],
    [CommonRegex.postalCode, faker.location.zipCode]
  ]);

  /**
   * Mapping of field types to faker utils
   */
  static #namesToType = {
    string: new Map<RegExp, () => string>([
      [/^(image|img).*url$/, faker.image.url],
      [/^url$/, faker.internet.url],
      [/^email(addr(ress)?)?$/, faker.internet.email],
      [/^(tele)?phone(num|number)?$/, faker.phone.number],
      [/^((postal|zip)code)|zip$/, faker.location.zipCode],
      [/f(irst)?name/, faker.person.firstName],
      [/l(ast)?name/, faker.person.lastName],
      [/^ip(add(ress)?)?$/, faker.internet.ip],
      [/^ip(add(ress)?)?(v?)6$/, faker.internet.ipv6],
      [/^username$/, faker.internet.username],
      [/^domain(name)?$/, faker.internet.domainName],
      [/^file(path|name)?$/, faker.system.filePath],
      [/^street(1)?$/, faker.location.streetAddress],
      [/^street2$/, faker.location.secondaryAddress],
      [/^county$/, faker.location.county],
      [/^country$/, faker.location.country],
      [/^state$/, faker.location.state],
      [/^lon(gitude)?$/, (): string => `${faker.location.longitude()}`],
      [/^lat(itude)?$/, (): string => `${faker.location.latitude()}`],
      [/(profile).*(image|img)/, faker.image.avatar],
      [/(image|img)/, faker.image.url],
      [/^company(name)?$/, faker.company.name],
      [/(desc|description)$/, faker.lorem.sentences.bind(null, 10)]
    ]),
    date: new Map([
      [/dob|birth/, (): Date => faker.date.past({ years: 60 })],
      [/creat(e|ion)/, this.#between.bind(null, -200, -100)],
      [/(update|modif(y|ied))/, this.#between.bind(null, -100, -50)]
    ]),
  };

  static #between(fromDays: number, toDays: number): Date {
    return faker.date.between({
      from: TimeUtil.fromNow(`${fromDays}d`),
      to: TimeUtil.fromNow(`${toDays}d`)
    });
  }

  /**
   * Get an array of values
   * @param config Field configuration
   */
  static #array(config: SchemaFieldConfig): unknown[] {
    const min = config.minlength ? config.minlength.limit : 0;
    const max = config.maxlength ? config.maxlength.limit : 10;
    const size = faker.number.int({ min, max });
    const out: unknown[] = [];
    for (let i = 0; i < size; i++) {
      out.push(this.#value(config, true));
    }
    return out;
  }

  /**
   * Get a new number value
   * @param config Number config
   */
  static #number(config: SchemaFieldConfig): number {
    let min = config.min && typeof config.min.limit === 'number' ? config.min.limit : undefined;
    let max = config.max && typeof config.max.limit === 'number' ? config.max.limit : undefined;
    let precision = config.precision;

    if (/(price|amt|amount)$/i.test(config.name)) {
      precision = [13, 2];
    }

    let offset = 1;

    if (precision !== undefined) {
      min ??= -((10 ** precision[0]) - 1);
      max ??= ((10 ** precision[0]) - 1);
      if (precision[1] !== undefined) {
        offset = (10 ** (precision[1] || 0));
      }
    }

    max ??= 1000;
    min ??= 0;

    const range = (max - min) * offset;
    const result = Math.trunc(Math.random() * range);
    return (result / offset) + min;
  }


  /**
   * Get a new bigint value
   * @param config BigInt config
   */
  static #bigInt(config: SchemaFieldConfig): bigint {
    const min = config.min && typeof config.min.limit === 'bigint' ? config.min.limit : 0n;
    const max = config.max && typeof config.max.limit === 'bigint' ? config.max.limit : 1000n;
    return faker.number.bigInt({ min, max, });
  }

  /**
   * Get a date value
   * @param config Field config
   */
  static #date(config: SchemaFieldConfig): Date {
    const name = config.name.toLowerCase();
    const min = config.min && config.min.limit instanceof Date ? config.min.limit : undefined;
    const max = config.max && config.max.limit instanceof Date ? config.max.limit : undefined;

    if (min !== undefined || max !== undefined) {
      return faker.date.between({ from: min || TimeUtil.fromNow('-50d'), to: max || new Date() });
    } else {
      for (const [regex, fn] of this.#namesToType.date) {
        if (regex.test(name)) {
          return fn();
        }
      }
      return faker.date.recent({ days: 50 });
    }
  }

  /**
   * Get a string value
   * @param config Field config
   */
  static #string(config: SchemaFieldConfig): string {
    const name = config.name.toLowerCase();

    if (config.match) {
      const mre = config.match && config.match.regex;
      for (const [regex, fn] of this.#stringToReType) {
        if (mre === regex) {
          return fn();
        }
      }
    }

    for (const [regex, fn] of this.#namesToType.string) {
      if (regex.test(name)) {
        return fn();
      }
    }

    return faker.word.sample();
  }

  /**
   * Get a value for a field config
   * @param config Field config
   */
  static #value(config: SchemaFieldConfig, subArray = false): unknown {
    if (!subArray && config.array) {
      return this.#array(config);
    } else if (config.enum) {
      return faker.helpers.arrayElement(config.enum.values);
    } else {
      switch (config.type) {
        case Number: return this.#number(config);
        case castTo(BigInt): return this.#bigInt(config);
        case String: return this.#string(config);
        case Date: return this.#date(config);
        case Boolean: return faker.datatype.boolean();
      }
      if (SchemaRegistryIndex.has(config.type)) {
        return this.generate(config.type);
      }
    }
  }

  /**
   * Generate a new instance of a class
   * @param cls The class to get an instance of
   * @param view The view to define specifically
   */
  static generate<T>(cls: Class<T>, view?: string): T {
    const fields = SchemaRegistryIndex.get(cls).getFields(view);
    const out: Record<string, unknown> = {};

    for (const [name, fieldConfig] of Object.entries(fields)) {
      if (name === 'type' || name === 'id') { // Do not set primary fields
        continue;
      }
      if (fieldConfig.required?.active === false && (Math.random() < .5)) {
        continue;
      }
      out[name] = this.#value(fieldConfig);
    }

    return BindUtil.bindSchema(cls, out, { view });
  }
}