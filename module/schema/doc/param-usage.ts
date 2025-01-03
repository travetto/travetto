import { Match, Min } from '@travetto/schema';

const NAME_REGEX = /[A-Z][a-z]+(\s+[A-Z][a-z]+)*/;

export class ParamUsage {
  main(@Match(NAME_REGEX) name: string, @Min(20) age?: number) {
    console.log('Valid name and age!', { name, age });
  }
}