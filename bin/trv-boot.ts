import * as path from 'path';
import { execSync } from 'child_process';

execSync(`npm run build -- ${process.argv.slice(2).join(' ')}`, {
  cwd: path.resolve(__dirname, '..', 'module/boot'),
  stdio: [0, 1, 2]
});