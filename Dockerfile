ARG NODE_VERSION=16

##################################################
## "build" stage
##################################################

FROM docker.io/node:$NODE_VERSION-alpine as build

WORKDIR /usr/local/src/demergi/
RUN chown node:node ./

USER node:node

COPY --chown=node:node ./package*.json ./
RUN npm ci

COPY --chown=node:node ./ ./
RUN npm run lint
RUN npm run test
RUN npm run build-bundle

##################################################
## "main" stage
##################################################

FROM docker.io/node:$NODE_VERSION-alpine as main

WORKDIR /usr/local/lib/demergi/
RUN chown root:root ./

USER node:node

COPY --from=build --chown=root:root /usr/local/src/demergi/dist/ ./

ENTRYPOINT ["/usr/local/bin/node", "./demergi.js"]
CMD []
