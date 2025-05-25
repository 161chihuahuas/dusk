#!/bin/sh

if [[ $OSTYPE == 'darwin'* ]]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  /usr/local/bin/brew install cadaver git python3 tor libusb ncruces/tap/zenity
else
  pkexec apt-get update
  DEBIAN_FRONTEND=noninteractive pkexec apt-get -yq upgrade
  DEBIAN_FRONTEND=noninteractive pkexec apt-get -yq install nano cadaver wget apt-transport-https gnupg curl libssl-dev git python3 build-essential tor libusb-dev zenity nautilus
fi

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

nvm install 22
npm install -g @tacticalchihuahua/dusk --omit dev

dusk --install --enable-autostart
