import { d, Mod, Library, Code } from '@travetto/doc';
import { AssetSource } from '@travetto/asset/src/source';
import { Config } from '@travetto/config';

export default d`
This provides a ${Library('mongodb', 'https://mongodb.com')} implementation of the ${AssetSource} which is a backend for the  ${Mod('asset')} module.  

${Code('Mongo backend wiring', 'alt/docs/src/config.ts')}
  
There is a default configuration that you can easily use, with some sensible defaults. 
  
${Code('Mongo configuration', 'src/config.ts')}
  
Additionally, you can see that the class is registered with the ${Config} annotation, and so these values can be overridden using the standard ${Mod('config')} resolution paths. 
`;
