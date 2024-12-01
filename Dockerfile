FROM debian:bookworm
LABEL maintainer "lily@tactcicalchihuahua.lol"
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install wget apt-transport-https gnupg curl libssl-dev git python3 build-essential tor libusb-dev
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
RUN git clone https://github.com/lilyannehall/dusk /root/dusk; \
#    cd /root/dusk; \
#    git fetch --tags; \
#    git checkout $(git describe --tags `git rev-list --tags --max-count=1`); \
    cd /root/dusk && npm install --unsafe-perm --production
VOLUME ["/root/.config/dusk"]
EXPOSE 5275
ENV dusk_ControlPortEnabled=1
ENV dusk_ControlSockEnabled=0
ENTRYPOINT ["/root/dusk/bin/dusk.js"]
CMD []
