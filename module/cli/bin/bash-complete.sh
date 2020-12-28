# Bash Autocompletion
_travetto()
{
    local trv="${PWD}/node_modules/.bin/travetto";
    local cur=${COMP_WORDS[COMP_CWORD]}    
    if [ -f "$trv" ]; then
      local words=`${trv} complete ${COMP_WORDS[@]:1}`
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
complete -o default -F _travetto trv