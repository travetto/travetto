#!/bin/sh
export ROOT=/Users/arcsine/Code/travetto/related/todo-app
export TRV_OUT=/Users/arcsine/Code/travetto/.trv/output
export DIST=/var/folders/6q/gzbcsdxx31l7k79tbl4cjbbm0000gn/T/_Users_arcsine_Code_travetto_related_todo-app
export MODULE=@travetto/todo-app
export REPO_ROOT=/Users/arcsine/Code/travetto

# Cleaning Output $DIST 

echo "Cleaning Output $DIST"

rm -rf $DIST
mkdir -p $DIST

# Writing $DIST/.env 

echo "Writing $DIST/.env"

echo "NODE_ENV=production" > $DIST/.env
echo "TRV_MANIFEST=manifest.json" >> $DIST/.env
echo "TRV_MODULE=$MODULE" >> $DIST/.env
echo "TRV_CLI_IPC=" >> $DIST/.env
echo "TRV_RESOURCE_OVERRIDES=@#resources=@@#resources" >> $DIST/.env

# Writing package.json 

echo "Writing package.json"

echo "{\"type\":\"module\",\"main\":\"todo-app.js\"}" > $DIST/package.json

# Writing entry scripts todo-app.sh args=() 

echo "Writing entry scripts todo-app.sh args=()"

echo "#!/bin/sh" > $DIST/todo-app.sh
echo "cd \$(dirname \"\$0\")" >> $DIST/todo-app.sh
echo "node todo-app.js \$@" >> $DIST/todo-app.sh
chmod 755 $DIST/todo-app.sh

# Writing entry scripts todo-app.cmd args=() 

echo "Writing entry scripts todo-app.cmd args=()"

echo "cd %~p0" > $DIST/todo-app.cmd
echo "node todo-app.js %*" >> $DIST/todo-app.cmd
chmod 755 $DIST/todo-app.cmd

# Copying over module resources 

echo "Copying over module resources"

cp -r -p $ROOT/resources/* $DIST/resources

# Writing Manifest manifest.json 

echo "Writing Manifest manifest.json"

TRV_MODULE=$MODULE $REPO_ROOT/node_modules/.bin/trvc manifest:production $DIST/manifest.json

# Bundling Output minify=true sourcemap=false entryPoint=@travetto/cli/support/entry.trv.ts 

echo "Bundling Output minify=true sourcemap=false entryPoint=@travetto/cli/support/entry.trv.ts"

export BUNDLE_ENTRY=node_modules/@travetto/cli/support/entry.trv.js
export BUNDLE_MAIN_FILE=todo-app.js
export BUNDLE_COMPRESS=true
export BUNDLE_SOURCEMAP=false
export BUNDLE_SOURCES=false
export BUNDLE_OUTPUT=$DIST
export BUNDLE_ENV_FILE=.env
export TRV_MANIFEST=$TRV_OUT/node_modules/$MODULE
cd $TRV_OUT
$REPO_ROOT/node_modules/.bin/rollup -c $TRV_OUT/node_modules/@travetto/pack/support/rollup/build.js
cd $ROOT

# Pulling Docker Base Image node:25-alpine 

echo "Pulling Docker Base Image node:25-alpine"

docker pull node:25-alpine

# Detected Image OS node:25-alpine as alpine 

echo "Detected Image OS node:25-alpine as alpine"


# Generating Docker File $DIST/Dockerfile @travetto/pack/support/pack.dockerfile.ts 

echo "Generating Docker File $DIST/Dockerfile @travetto/pack/support/pack.dockerfile.ts"

echo "FROM node:25-alpine" > $DIST/Dockerfile
echo "RUN addgroup -g 2000 app && adduser -D -G app -u 2000 app" >> $DIST/Dockerfile
echo "RUN mkdir /app && chown app:app /app" >> $DIST/Dockerfile
echo "COPY --chown=\"app:app\" . /app" >> $DIST/Dockerfile
echo "ENV NODE_OPTIONS=\"\"" >> $DIST/Dockerfile
echo "" >> $DIST/Dockerfile
echo "USER app" >> $DIST/Dockerfile
echo "WORKDIR /app" >> $DIST/Dockerfile
echo "ENTRYPOINT [\"/app/todo-app.sh\"]" >> $DIST/Dockerfile

# Building Docker Container latest 

echo "Building Docker Container latest"

cd $DIST
docker build -t travetto_todo-app:latest .
cd $ROOT


