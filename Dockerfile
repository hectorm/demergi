##################################################
## "base-rootfs" stage
##################################################

FROM registry.access.redhat.com/ubi8/ubi:latest as base-rootfs

RUN install -D /etc/yum.repos.d/ubi.repo /mnt/rootfs/etc/yum.repos.d/ubi.repo
RUN dnf --installroot /mnt/rootfs/ module enable -y --releasever 8 nodejs:16
RUN dnf --installroot /mnt/rootfs/ module install -y --releasever 8 --setopt install_weak_deps=false --nodocs nodejs:16/common
RUN dnf --installroot /mnt/rootfs/ clean all && rm -rf /mnt/rootfs/var/cache/* /mnt/rootfs/var/log/dnf* /mnt/rootfs/var/log/yum.*

##################################################
## "base" stage
##################################################

FROM scratch as base

ENV HOME=/opt/app/
ENV NPM_CONFIG_PREFIX=${HOME}/.npm-global/
ENV PATH=${HOME}/node_modules/.bin/:${NPM_CONFIG_PREFIX}/bin/:${PATH}

COPY --from=base-rootfs /mnt/rootfs/ /

RUN mkdir "${HOME:?}" && chown 1001:0 "${HOME:?}" && chmod 775 "${HOME:?}"
WORKDIR ${HOME}

USER 1001:0

##################################################
## "build" stage
##################################################

FROM base as build

COPY --chown=1001:0 ./package*.json ./
RUN npm ci

COPY --chown=1001:0 ./ ./
RUN npm run lint
RUN npm run test
RUN npm run build

##################################################
## "main" stage
##################################################

FROM base as main

COPY --from=build ${HOME}/dist/demergi.js ./
RUN /usr/bin/node ./demergi.js -v

ENTRYPOINT ["/usr/bin/node", "./demergi.js"]
CMD []
