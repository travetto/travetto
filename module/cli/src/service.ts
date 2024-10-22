/**
 * This represents the schema for defined services
 */
export interface ServiceDescriptor {
  name: string;
  version: string | number;
  port?: number;
  ports?: Record<number, number>;
  privileged?: boolean;
  image: string;
  args?: string[];
  ready?: { url: string, test?(body: string): boolean };
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  require?: string;
  startupTimeout?: number;
  label?: string;
}