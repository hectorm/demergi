##################################################
## "build" stage
##################################################

FROM docker.io/node:20.14.0-bookworm@sha256:d0a9a2399581a9de1ff962a48a28b5cfe700678a6a5df8e31a63aaa47bebb923 AS build

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
