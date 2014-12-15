#. .rvm/scripts/rvm

source_path="$(pwd)/${BASH_SOURCE:-$_}"
export rvm_path="$(dirname "$source_path")/../.rvm"
. "$rvm_path/scripts/rvm"
rvm reload &> /dev/null
rvm use 2.1.5
rvm rvmrc warning ignore /home/rush/virtkick/webapp/Gemfile
alias x="bundle exec"