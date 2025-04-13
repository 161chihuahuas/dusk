FROM debian:bookworm
LABEL maintainer "161chihuahuas@disroot.org"
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install wget apt-transport-https gnupg curl libssl-dev git python3 build-essential tor libusb-dev ftp
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
RUN git clone https://github.com/161chihuahuas/dusk /root/dusk; \
    cd /root/dusk && npm install --unsafe-perm --production
VOLUME ["/root/.config/dusk"]
EXPOSE 5275
EXPOSE 5276
ENV dusk_ControlPortEnabled=1
ENV dusk_ControlSockEnabled=0
ENTRYPOINT ["/root/dusk/bin/dusk.js"]
CMD []
