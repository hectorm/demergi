##################################################
## "build" stage
##################################################

FROM docker.io/node:22.19.0-bookworm@sha256:6fe286835c595e53cdafc4889e9eff903dd3008a3050c1675809148d8e0df805 AS build

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

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:71c8c9f567572da433cf7ecdada692ea753d6bda71257afae4fa09080aa75ec6 AS main

COPY --from=build --chown=0:0 --chmod=755 /usr/local/bin/node /node
COPY --from=build --chown=0:0 --chmod=755 /src/dist/demergi.js /app/demergi.js

WORKDIR /app/

RUN ["/node", "/app/demergi.js", "--version"]

ENTRYPOINT ["/node", "/app/demergi.js"]
CMD []
