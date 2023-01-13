##################################################
## "base-rootfs" stage
##################################################

FROM registry.access.redhat.com/ubi9/ubi:latest AS base-rootfs

RUN mkdir /mnt/rootfs/ \
	&& install -D /etc/yum.repos.d/ubi.repo /mnt/rootfs/etc/yum.repos.d/ubi.repo \
	&& dnf --installroot /mnt/rootfs/ install -y --releasever 9 --setopt install_weak_deps=false --nodocs coreutils-single glibc-minimal-langpack \
	&& dnf --installroot /mnt/rootfs/ module reset -y nodejs && dnf --installroot /mnt/rootfs/ module enable -y nodejs:18 \
	&& mkdir /mnt/rootfs/opt/app/ && chown 1001:0 /mnt/rootfs/opt/app/ && chmod 775 /mnt/rootfs/opt/app/ \
	&& rm -rf /mnt/rootfs/var/cache/* /mnt/rootfs/var/log/* /mnt/rootfs/tmp/*

##################################################
## "build-rootfs" stage
##################################################

FROM base-rootfs AS build-rootfs

RUN dnf --installroot /mnt/rootfs/ install -y --setopt install_weak_deps=true --nodocs nodejs npm \
	&& rm -rf /mnt/rootfs/var/cache/* /mnt/rootfs/var/log/* /mnt/rootfs/tmp/*

##################################################
## "main-rootfs" stage
##################################################

FROM base-rootfs AS main-rootfs

RUN dnf --installroot /mnt/rootfs/ install -y --setopt install_weak_deps=false --nodocs nodejs \
	&& rm -rf /mnt/rootfs/var/cache/* /mnt/rootfs/var/log/* /mnt/rootfs/tmp/*

##################################################
## "base" stage
##################################################

FROM scratch AS base

ENV HOME=/opt/app/
ENV NPM_CONFIG_PREFIX=${HOME}/.npm-global/
ENV PATH=${HOME}/node_modules/.bin/:${NPM_CONFIG_PREFIX}/bin/:${PATH}

USER 1001:0
WORKDIR ${HOME}

##################################################
## "build" stage
##################################################

FROM base AS build

COPY --from=build-rootfs /mnt/rootfs/ /
RUN npm install -g npm@latest

COPY --chown=1001:0 ./package*.json ./
RUN npm ci

COPY --chown=1001:0 ./ ./
RUN npm run lint
RUN npm run test
RUN npm run build

##################################################
## "main" stage
##################################################

FROM base AS main

COPY --from=main-rootfs /mnt/rootfs/ /

COPY --from=build ${HOME}/dist/demergi.js ./
RUN /usr/bin/node ./demergi.js -v

ENTRYPOINT ["/usr/bin/node", "./demergi.js"]
CMD []
