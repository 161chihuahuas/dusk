#!/bin/sh

pkexec apt-get update
DEBIAN_FRONTEND=noninteractive pkexec apt-get -yq upgrade
DEBIAN_FRONTEND=noninteractive pkexec apt-get -yq install nano cadaver wget apt-transport-https gnupg curl libssl-dev git python3 build-essential tor libusb-dev ftp zenity nautilus
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
nvm install 22
npm install -g @tacticalchihuahua/dusk
dusk --install --enable-autostart
