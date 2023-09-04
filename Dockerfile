ARG NODE_VERSION=18

##################################################
## "base-rootfs" stage
##################################################

FROM registry.access.redhat.com/ubi9/ubi:latest AS base-rootfs

RUN mkdir /mnt/rootfs/
WORKDIR /mnt/rootfs/

RUN find /etc/yum.repos.d/ /etc/dnf/vars/ -type f -exec install -vD '{}' '.{}' ';'
RUN RELEASEVER=$(python3 -c 'import dnf; print(dnf.dnf.Base().conf.substitutions["releasever"])') \
	&& dnf --installroot "${PWD:?}" install -y --releasever "${RELEASEVER:?}" --setopt install_weak_deps=false --nodocs \
		coreutils-single \
		glibc-minimal-langpack \
	&& rm -rf ./var/cache/* ./var/log/* ./tmp/*

RUN printf '%s\n' 'app:x:172761424:0::/opt/app/:/bin/sh' >> ./etc/passwd
RUN printf '%s\n' 'app:*:0:0:99999:7:::' >> ./etc/shadow
RUN mkdir ./opt/app/ && chmod 770 ./opt/app/ && chown 172761424:0 ./opt/app/

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

ENV HOME=/opt/app
ENV NPM_CONFIG_PREFIX=${HOME}/.npm/global
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV PATH=${HOME}/node_modules/.bin/:${NPM_CONFIG_PREFIX}/bin/:${PATH}

WORKDIR /opt/app/
USER app:0

##################################################
## "build" stage
##################################################

FROM base AS build

COPY --from=build-rootfs /mnt/rootfs/ /

COPY --chown=app:0 ./package*.json ./
RUN npm ci

COPY --chown=app:0 ./ ./
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
