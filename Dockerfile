ARG NODE_VERSION=18
ARG APP_UID=172761424 APP_GID=0

##################################################
## "base-rootfs" stage
##################################################

FROM registry.access.redhat.com/ubi9/ubi:latest AS base-rootfs
ARG APP_UID APP_GID

RUN mkdir /mnt/rootfs/
WORKDIR /mnt/rootfs/

RUN find /etc/yum.repos.d/ /etc/dnf/vars/ -type f -exec install -vD '{}' '.{}' ';'
RUN RELEASEVER=$(python3 -c 'import dnf; print(dnf.dnf.Base().conf.substitutions["releasever"])') \
	&& dnf --installroot "${PWD:?}" install -y --releasever "${RELEASEVER:?}" --setopt install_weak_deps=false --nodocs \
		coreutils-single \
		glibc-minimal-langpack \
	&& rm -rf ./var/cache/* ./var/log/* ./tmp/*

RUN mkdir ./opt/app/
RUN chmod 770 ./opt/app/
RUN chown "${APP_UID:?}:${APP_GID:?}" ./opt/app/

##################################################
## "build-rootfs" stage
##################################################

FROM base-rootfs AS build-rootfs
ARG NODE_VERSION

RUN dnf --installroot "${PWD:?}" module install -y --setopt install_weak_deps=true --nodocs \
		nodejs:"${NODE_VERSION:?}"/development \
	&& rm -rf ./var/cache/* ./var/log/* ./tmp/*

##################################################
## "main-rootfs" stage
##################################################

FROM base-rootfs AS main-rootfs
ARG NODE_VERSION

RUN dnf --installroot "${PWD:?}" module install -y --setopt install_weak_deps=false --nodocs \
		nodejs:"${NODE_VERSION:?}"/minimal \
	&& rm -rf ./var/cache/* ./var/log/* ./tmp/*

##################################################
## "base" stage
##################################################

FROM scratch AS base
ARG APP_UID APP_GID

ENV HOME=/opt/app/
ENV NPM_CONFIG_PREFIX=${HOME}/.npm/global/
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV PATH=${HOME}/node_modules/.bin/:${NPM_CONFIG_PREFIX}/bin/:${PATH}

USER ${APP_UID}:${APP_GID}
WORKDIR /opt/app/

##################################################
## "build" stage
##################################################

FROM base AS build
ARG APP_UID APP_GID

COPY --from=build-rootfs /mnt/rootfs/ /

RUN npm install -g npm@latest

COPY --chown=${APP_UID}:${APP_GID} ./package*.json ./
RUN npm ci

COPY --chown=${APP_UID}:${APP_GID} ./ ./
RUN npm run lint
RUN npm run test
RUN npm run build

##################################################
## "main" stage
##################################################

FROM base AS main

COPY --from=main-rootfs /mnt/rootfs/ /

COPY --from=build /opt/app/dist/demergi.js ./

RUN ["/usr/bin/node", "./demergi.js", "--version"]
ENTRYPOINT ["/usr/bin/node", "./demergi.js"]
CMD []
