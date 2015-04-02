export RVM_DIR="$(pwd)/.rvm"

VIRTKICK_RUBY_VERSION=$(grep "^ruby '.*'$" webapp/Gemfile | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
SAVED_RUBY_VERSION=$(cat $RVM_DIR/installed 2> /dev/null || echo "")

if [ "$VIRTKICK_RUBY_VERSION" != "$SAVED_RUBY_VERSION" ];then
  rm -f "$RVM_DIR/installed"
fi

if ! [ -e "$RVM_DIR/installed" ];then
  rm -rf "$RVM_DIR"
fi

export rvm_user_install_flag=1
export rvm_path="$RVM_DIR"
unset GEM_HOME # unset any previous ruby setup
if ! [ -e "$RVM_DIR" ];then
  mkdir -p "$RVM_DIR"

  curl -sSL https://get.rvm.io | bash -s stable --ignore-dotfiles #--autolibs=rvm_pkg
  . .rvm/scripts/rvm
#  export PATH="$RVM_DIR/bin:$PATH"

  rvm install $VIRTKICK_RUBY_VERSION -j 8
  rvm use $VIRTKICK_RUBY_VERSION
  gem install bundler
  rvm alias create default $VIRTKICK_RUBY_VERSION
  echo $VIRTKICK_RUBY_VERSION > "$RVM_DIR/installed"
  bundle config build.nokogiri --use-system-libraries
else
  . .rvm/scripts/rvm
  rvm use $VIRTKICK_RUBY_VERSION
  bundle config build.nokogiri --use-system-libraries
fi
which bundle |grep $RVM_DIR > /dev/null || (echo "Problem with ruby setup, bundle points to $(which bundle), should be in $RVM_DIR"; exit 1)

