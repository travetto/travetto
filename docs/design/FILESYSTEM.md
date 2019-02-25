# File System Design

The original idea was to try to augment all of `fs`/`path` functionality, but as it turns out, Windows honors forward slashes on paths, and so all that is needed, is to ensure that all paths, as they are being read or constructed, are converted to `/` urls vs `\`.  The path module has been augmented to include `.toUnix`, `.resolveUnix`, `.joinUnix`.  This allows for simplistic handling for importing, and converting seamlessly.

When running programs in Windows, the `/` are generally reserved for program flags, and so the slashes need to be set to native whenever running any commands.