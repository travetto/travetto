#!/bin/sh
export DIST=/tmp/_home_tim_Code_travetto_related_todo-app
export TRV_OUT=/home/tim/Code/travetto/.trv_output
export ROOT=/home/tim/Code/travetto/related/todo-app
export MOD=@travetto/todo-app

# Cleaning Output $DIST 

rm -rf $DIST
mkdir -p $DIST

# Writing .env.js 

echo "process.env.TRV_MANIFEST = 'node_modules/$MOD';" > $DIST/.env.js
echo "process.env.TRV_CLI_IPC = '';" >> $DIST/.env.js

# Writing package.json 

echo "{\"type\":\"commonjs\"}" > $DIST/package.json

# Writing entry scripts cli.sh args=(run rest) 

echo "#!/bin/sh" > $DIST/cli.sh
echo "cd \$(dirname \"\$0\")" >> $DIST/cli.sh
echo "node cli run rest \$@" >> $DIST/cli.sh
chmod 755 $DIST/cli.sh

# Writing entry scripts cli.cmd args=(run rest) 

echo "" > $DIST/cli.cmd
echo "cd %~p0" >> $DIST/cli.cmd
echo "node cli run rest %*" >> $DIST/cli.cmd
chmod 755 $DIST/cli.cmd

# Copying over resources 

mkdir -p $DIST/node_modules/$MOD
cp $TRV_OUT/node_modules/$MOD/package.json $DIST/node_modules/$MOD/package.json
mkdir -p $DIST/node_modules/@travetto/manifest
cp $TRV_OUT/node_modules/@travetto/manifest/package.json $DIST/node_modules/@travetto/manifest/package.json
cp -r -p $ROOT/resources $DIST/resources

# Generating App Cache node_modules/$MOD/trv-app-cache.json 

mkdir -p $DIST/node_modules/$MOD
DEBUG=0 TRV_MODULE=$MOD npx trv main @travetto/app/support/bin/list > $DIST/node_modules/$MOD/trv-app-cache.json

# Writing Manifest node_modules/$MOD 

TRV_MODULE=$MOD npx trv manifest $DIST/node_modules/$MOD prod

# Bundling Output minify=true sourcemap= entryPoint=node_modules/@travetto/cli/support/cli.js 

export BUNDLE_ENTRY=node_modules/@travetto/cli/support/cli.js
export BUNDLE_ENTRY_NAME=cli
export BUNDLE_COMPRESS=true
export BUNDLE_OUTPUT=$DIST
export BUNDLE_FORMAT=commonjs
export TRV_MANIFEST=$TRV_OUT/node_modules/$MOD
cd $TRV_OUT
npx rollup -c node_modules/@travetto/pack/support/bin/rollup.js
cd $ROOT

# Generating Docker File $DIST/Dockerfile @travetto/pack/support/pack.dockerfile 

echo "FROM node:18-alpine3.16" > $DIST/Dockerfile
echo "WORKDIR /app" >> $DIST/Dockerfile
echo "COPY . ." >> $DIST/Dockerfile
echo "" >> $DIST/Dockerfile
echo "ENTRYPOINT [\"/app/cli.sh\"]" >> $DIST/Dockerfile

# Pulling Docker Base Image node:18-alpine3.16 

docker pull node:18-alpine3.16

# Building Docker Container latest 

cd $DIST
docker build -t travetto_todo-app:latest .
cd $ROOT