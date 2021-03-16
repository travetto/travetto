import '@arcsine/nodesh';
import * as path from 'path';
import * as fs from 'fs';

'module/*/*.tgz'
  .$dir()
  .$tap(file =>
    $exec('npm', {
      args: ['publish'],
      spawn: {
        env: {
          NPM_CONFIG_OTP: $argv[0]
        },
        cwd: path.dirname(file)
      }
    })
  )
  .$forEach(file => fs.unlinkSync(file));