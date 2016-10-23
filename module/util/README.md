encore: Util
===

This module provides some common utilities.  They can be broken into:

   - **Object Utilities**.  This is generally a subset of `lodash`, but is intended
      to minimize the use of `lodash` throughout the apps.  ES2015+ provides quite
      a bit of what `lodash` has generally been used for.  The goal is to write as 
      much native JavaScript as possible while providing some common use cases
      that ES2015+ do not support.  Once these features become standard, these
      utilities will fall by the way-side.

   - **Promises**.  This is generally for mapping between Node callback syntax to a proper
     Promise, and convert a Promise to be used in place of a Node callback.  Once NodeJS supports
     Promises natively in the core library, this will be obsolete.

   - **Bulk Require**.  This is for mixing glob commands and require together, to act as 
     a sort of component-scan mechanism.  This gives the ability to ensure certain modules
     are all loaded without hard-coding the imports.  Usefully for convention based setups.