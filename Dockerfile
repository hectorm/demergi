ARG NODE_VERSION=16

##################################################
## "build" stage
##################################################

FROM registry.access.redhat.com/ubi8/nodejs-$NODE_VERSION:latest as build

WORKDIR $APP_ROOT/src/

COPY ./package*.json ./
RUN npm ci

COPY ./ ./
RUN npm run lint
RUN npm run test
RUN npm run build

##################################################
## "main" stage
##################################################

FROM registry.access.redhat.com/ubi8/nodejs-$NODE_VERSION-minimal:latest as main

WORKDIR $APP_ROOT

COPY --from=build $APP_ROOT/src/dist/demergi.js ./

USER nobody:nobody
ENTRYPOINT ["/usr/bin/node", "./demergi.js"]
CMD []
