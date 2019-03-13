_travetto()
{
    local trvComp="${PWD}/node_modules/.bin/travetto";
    local cur=${COMP_WORDS[COMP_CWORD]}    
    if [ -f "$trvComp" ]; then
      if [[ 'module/cli' == *"$PWD" ]] && [[ -z "$TRV_FRAMEWORK_DEV" ]]; then
        export NODE_PRESERVE_SYMLINKS=1
        export TRV_FRAMEWORK_DEV=1
      fi
      local words=`${trvComp} complete ${COMP_WORDS[@]:1}`
      if [[ -z "$words" ]]; then
        COMPREPLY=( )
      else
      COMPREPLY=( $(compgen  -W "$words" -- $cur) )
      fi
    else
      COMPREPLY=( )
    fi 
}
complete -o default -F _travetto travetto