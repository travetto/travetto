import { type NodePackageManager } from '@travetto/manifest';
import { Runtime } from '@travetto/runtime';

export class PackageDocUtil {
  /**
   * Get an the command for executing a package level binary
   */
  static getPackageCommand(pkg: string, args: string[] = [], manager?: NodePackageManager): string {
    switch (manager ?? Runtime.workspace.manager) {
      case 'npm':
      case 'yarn': return `npx ${pkg} ${args.join(' ')}`.trim();
    }
  }

  /**
   * Get an the command for executing a package level binary
   */
  static getWorkspaceInitCommand(manager?: NodePackageManager): string {
    switch (manager ?? Runtime.workspace.manager) {
      case 'npm': return 'npm init -f';
      case 'yarn': return 'yarn init -y';
    }
  }

  /**
   * Get an install command for a given npm module
   */
  static getInstallCommand(pkg: string, production = false, manager?: NodePackageManager): string {
    switch (manager ?? Runtime.workspace.manager) {
      case 'npm': return `npm install ${production ? '' : '--save-dev '}${pkg}`;
      case 'yarn': return `yarn add ${production ? '' : '--dev '}${pkg}`;
    }
  }

  /**
   * Get install example for a given package
   */
  static getInstallInstructions(pkg: string, production = false): string {
    return (['npm', 'yarn'] as const)
      .map(cmd => this.getInstallCommand(pkg, production, cmd))
      .join('\n\n# or\n\n');
  }
}