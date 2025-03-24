##################################################
## "build" stage
##################################################

FROM docker.io/node:20.15.1-bookworm@sha256:6326b52a508f0d99ffdbfaa29a69380321b215153db6f32974835bac71b38fa4 AS build

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

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:db467849093a0eeea12ccb3bb0c547dd55b377bea70ffd067a16e2db305fa182 AS main

COPY --from=build --chown=0:0 --chmod=755 /usr/local/bin/node /node
COPY --from=build --chown=0:0 --chmod=644 /src/dist/ /app/

WORKDIR /app/

RUN ["/node", "/app/demergi.js", "--version"]

ENTRYPOINT ["/node", "/app/demergi.js"]
CMD []
