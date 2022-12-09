import { d } from '@travetto/doc';

export const text = () => d`
${d.Header()}

This module provides functionality for basic path functionality and common typings for manifests

${d.SubSection('Module Indexing')}
The bootstrap process will also produce an index of all source files, which allows for fast in-memory scanning.  This allows for all the automatic discovery that is used within the framework.
`;