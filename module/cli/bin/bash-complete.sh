_travetto()
{
    local TRV_COMP="${PWD}/node_modules/.bin/travetto";
    local CUR=${COMP_WORDS[COMP_CWORD]}    
    if [ -f "$TRV_COMP" ]; then
      local ON=0
      if (cat ${PWD}/package.json | grep '"name": "@travetto"'); then
        ON=1
      fi
      local WORDS=`TRV_DEV=$ON NODE_PRESERVE_SYMLINKS=$ON ${TRV_COMP} complete ${COMP_WORDS[@]:1}`
      if [[ -z "$WORDS" ]]; then
        COMPREPLY=( )
      else
      COMPREPLY=( $(compgen  -W "$WORDS" -- $CUR) )
      fi
    else
      COMPREPLY=( )
    fi 
}
complete -o default -F _travetto travetto
complete -o default -F _travetto trv