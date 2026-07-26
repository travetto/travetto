# Travetto 3.1 Release Notes

> Release 3.1.0: 2023-03-01 -- Momentum

## Major/Breaking Changes

## Upgrade to Typescript 5.0
* Upgrade to Typescript 5.0

## CLI/App Overhaul
* @travetto/app is gone, and has been merged into @travetto/cli
* @travetto/cli has been completely rewritten and now is entirely based on @travetto/schema
* @travetto/schema Param decorators have been modified to deal with invalid type support
* @travetto/cli Exclude the README.\*, DOC.\* from  change detection for dependent changes.
* @travetto/{cli,repo} Moved repo specific commands to the repo module, version, list.
* @travetto/cli Fixed bug with support for negative numbers on the CLI
* @travetto/repo  Allow cli to be invoked from sub folders when package.json isn't directly available
* @travetto/watch Reworked watch behavior, and unified the streams of recursive and immediate into single method

## Terminal Upgrades for User Experience
* @travetto/terminal Streaming operations to a single line, now truncate content for said line
* @travetto/terminal Push terminal state queries to a sub process to mitigate weird state behavior

## Pack output is now isolated
* @travetto/manifest Removed need for package.json reading at runtime, all data is now integrated into the manifest.json
* @travetto/pack Reworked output to be fully self contained (node_modules in output is gone)
* @travetto/config Added support to ingest a JSON blob via env var

## Model Enhancements
* @travetto/model prePersist now runs pre-validation, this allows filling in required values via prePersist
* @travetto/model Standardized uuid generation and validation, and allow for fully custom uuid support
* @travetto/model Extended support for multiple specifiers for a single field

## DI Integration with 3rd Party Code
* @travetto/di Now supports injecting/declaring (via @InjectableFactory) 3rd party code

## Compiler/VScode Plugin Upgrade
* vscode-plugin Overhaul of app logic, moving to cli for execution
* vscode-plugin Rework of compiler invocation to handle invalid states better, and to provide inline progress of compilation
* @travetto/compiler Reworked exit, and signaling of progress for use by external tools
