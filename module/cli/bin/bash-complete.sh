_travetto()
{
    local trvComp="${PWD}/node_modules/.bin/travetto";
    local cur=${COMP_WORDS[COMP_CWORD]}    
    if [ -f "$trvComp" ]; then
      if [[ 'travetto/module/' == *"$PWD" ]] && [[ -z "$NODE_PRESERVE_SYMLINKS" ]]; then
        export NODE_PRESERVE_SYMLINKS=1
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