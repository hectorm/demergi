##################################################
## "build" stage
##################################################

FROM docker.io/node:20.15.0-bookworm@sha256:b849bc4078c3e16a38d72749ab8faeacbcc6c3bdb742399b4a5974a89fc93261 AS build

ENV NPM_CONFIG_CACHE=/npm

WORKDIR /src/

COPY ./package.json ./package-lock.json /src/

RUN --mount=type=cache,id=npm,dst=/npm/ \
	npm ci

COPY ./ /src/

RUN --mount=type=cache,id=npm,dst=/npm/ \
	npm run test:node

RUN --mount=type=cache,id=npm,dst=/npm/ \
	npm run build:bundle

##################################################
## "main" stage
##################################################

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:b9452f5cd004c1610d4056be70343a8a7ea3d46bcf0fda3ce90f1ed90e70989c AS main

COPY --from=build --chown=0:0 --chmod=755 /usr/local/bin/node /node
COPY --from=build --chown=0:0 --chmod=644 /src/dist/ /app/

WORKDIR /app/

RUN ["/node", "/app/demergi.js", "--version"]

ENTRYPOINT ["/node", "/app/demergi.js"]
CMD []
