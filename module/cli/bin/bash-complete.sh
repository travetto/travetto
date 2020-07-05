# Bash Autocompletion
_travetto()
{
    local TRV_COMP="${PWD}/node_modules/.bin/travetto";
    local CUR=${COMP_WORDS[COMP_CWORD]}    
    if [ -f "$TRV_COMP" ]; then
      local WORDS=`${TRV_COMP} complete ${COMP_WORDS[@]:1}`
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