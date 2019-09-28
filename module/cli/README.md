CLI Support
===

**Install: primary**
```bash
$ npm install -g @travetto/cli
```

The cli is the primary structure for interacting with the external requirements of the framework.  This can range from running tests, to running applications, to generating email templates. The main executable can be installed globally or locally.  If installed globally and locally, it will defer to the local installation for execution.

As is the custom, modules are able to register their own cli extensions as scripts, whose name starts with `travetto-cli-`.  These scripts are then picked up at runtime and all available options are provided when viewing the help documentation.  The following are all the supported cli operations and the various settings they allow.

## General

**Terminal: General Usage**
```bash
travetto --help
Usage: travetto [options] 
Options:
  ...
```
This will show all the available options/choices that are exposed given the currently installed modules.


## Base

**Terminal: Clean operation**
```bash
travetto clean
```

Clears [`Boot`](https://github.com/travetto/travetto/tree/master/module/boot) compilation cache to handle any inconsistencies that may arise from checking timestamps for cache freshness.

## Compiler

**Terminal: Compiler usage**
```bash
travetto compile
  -o, --output <output>  # Output directory
  -r, --runtime-dir [runtimeDir]  # Expected root path during runtime      
```
This command line operation invokes the [`Compiler`](https://github.com/travetto/travetto/tree/master/module/compiler) to pre-compile of all the application source code.  This is useful for production builds when startup performance is critical.

## Application

**Terminal: Run usage**
```bash
travetto run [application]
  -e, --env [env]  # Application environment
  -w, --watch [watch]  # Run the application in watch mode
  -p, --profile [profile]  # Specify additional application profiles
```
The run command allows for invocation of [`Application`](https://github.com/travetto/travetto/tree/master/module/app)-based applications as defined by the `@Application` decorator.  Additionally, the environment can manually be specified (dev, test, prod, e2e) as well as whether or not the application should be run in `watch` mode.

## Testing

**Terminal: Test usage**
```bash
travetto test [regexes...]
  -f, --format <format>  # Output format for test results, valid formats are: tap (default), json, noop, exec, event
  -c, --concurrency <concurrency>  # Number of tests to run concurrently, defaults to number of CPUs - 1
  -m, --mode <mode>  # Test run mode: all (default), single
```
The regexes are the patterns of tests you want to run, and all tests must be found under the `test/` folder.

The test command is the only supported method for invoking the [`Test`](https://github.com/travetto/travetto/tree/master/module/test) module via the command line.  As stated in the test documentation, the primary output format is `tap`.  Additionally the code supports `json` and `event` as formats that can be consumed programmatically.  `exec` is used internally for sub-dividing tests to run concurrently, and communicate results over IPC.

## Email Templating

**Terminal: Email template usage**
```bash
travetto email-template
``` 

This command is provided by [`email-template`](https://github.com/travetto/travetto/tree/master/module/email-template).  It will spin up a web server (port 3839) with live reload.  This is to allow for real time configuring and testing of email templates through the templating pipeline.  You would navigate to the path of an asset, e.g. `http://localhost:3839/my-email.html`, to test and develop the file in `<root>/resources/email/my-email.html`.  You can also change the extension to `.txt` to see the textual representation.

Additionally,  contextual variables can be specified via query parameters to see what a fully resolved email could look like.

## Swagger Spec Generation

**Terminal: Swagger usage**
```bash
travetto swagger-spec
  -o, --output [output]  # Output folder, defaults to ./api-client
```

The command will run your application, in non-server mode, to collect all the routes and model information, to produce the `swagger.json`.  Once produced, the code will store the output in the specified location.  

**NOTE** The [`Swagger`](https://github.com/travetto/travetto/tree/master/module/swagger) module supports generating the swagger spec in real-time while listening for changes to routes and models.
