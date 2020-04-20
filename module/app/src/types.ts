import { Class } from '@travetto/registry';

export interface Runnable {
  run(): any;
}

export interface ApplicationParameter {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  meta?: {
    choices: string[];
    [key: string]: any;
  };
  def?: string;
  optional?: boolean;
}

export interface ApplicationConfig<T = any> {
  name: string;
  filename: string;
  description?: string;
  params?: ApplicationParameter[];
  target: Class<T>;
  watchable?: boolean;
}

export interface AppListener {
  kill?(): Promise<void>;
  wait?(): Promise<void>;
}