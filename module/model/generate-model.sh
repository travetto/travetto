#!/bin/bash 

ROOT='src/app';
CORE=node_modules/@encore
MOD=src/lib/model

rf -rf build/

COMPILE="tsc --lib es2015,es2016,dom -m es2015 --outDir build/ --experimentalDecorators"
DECLS=$(find $ROOT/model -name '*.ts' |\
  grep -v 'typings.d.ts' |\
  grep -v 'index.ts' |\
  grep -v 'index.d.ts')
  
for f in $DECLS; do
  COMPILE="$COMPILE --declaration $f"
done

echo $COMPILE

$COMPILE --declaration $CORE/mongo/$MOD/*.ts  --declaration $CORE/model/$MOD/*.ts

DECLS=`find build/ -name '*.d.ts' | grep 'model' `

cat $DECLS |\
  grep -v import |\
  grep -v \(\) |\
  grep -v static |\
  tr '\t' ' ' |\
  sed \
    -e 's/export \*.*$//' \
    -e 's/ default / /' \
    -e 's/export /declare /' \
    -e 's/\(const \(.*\)\):/interface \2 /' \
    -e 's/const  /interface /' \
    -e 's/class /interface /' \
    -e 's/abstract //' \
    -e 's/declare declare/declare/' \
    -e 's/declare/export/' \
    -e 's/implements /extends /' \
    -e 's/ \([A-Za-z_]\{1,100\}\): \([A-Za-z]\)/ \1?: \2/g' |\
  tr '\n' '\t' |\
  perl -pe 's/export [_A-Z][^;]+;//g' |\
  perl -pe 's/constructor[^)]*\);//g' |\
  tr '\t' '\n' > model.ts

rm -rf build/