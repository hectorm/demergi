[![Last version](https://img.shields.io/github/v/release/hectorm/demergi?label=version)](https://github.com/hectorm/demergi/releases)
[![CI status](https://img.shields.io/github/workflow/status/hectorm/demergi/CI?label=build)](https://github.com/hectorm/demergi/actions/workflows/ci.yml)
[![Docker image size](https://img.shields.io/docker/image-size/hectorm/demergi/latest?label=docker%20image%20size)](https://hub.docker.com/r/hectorm/demergi/tags)

***

# Demergi

A zero dependency proxy server that helps to bypass the DPI (Deep Packet Inspection) systems implemented by [various ISPs](./ISP.md).

## CLI

You can install Demergi with [npm](https://www.npmjs.com/package/demergi):
```sh
npm install -g demergi
```

After installation you can run it with the `demergi` command.

```
$ demergi --help
Usage: demergi [OPTION]...

A proxy server that helps to bypass the DPI systems implemented by various ISPs.

Proxy:
  -A, --addr STR, $DEMERGI_ADDR
  The address to bind the server to ("::" by default).

  -P, --port NUM, $DEMERGI_PORT
  The port to bind the server to (8080 by default).

  -H, --host-list STR, $DEMERGI_HOST_LIST
  The host list separated by commas or spaces to apply the evasion techniques,
  will be applied to all hosts if unspecified (unspecified by default).

  -W, --workers NUM, $DEMERGI_WORKERS
  The number of workers (0 by default).

Resolver:
  --dns-mode STR, $DEMERGI_DNS_MODE
  The DNS resolver mode, valid values are "plain" and "dot" ("dot" by default).

  --dns-cache-size NUM, $DEMERGI_DNS_CACHE_SIZE
  The maximum number of entries in the DNS cache (100000 by default).

  --dot-host STR, $DEMERGI_DOT_HOST
  The DoT server host ("1.0.0.1" by default).

  --dot-port NUM, $DEMERGI_DOT_PORT
  The DoT server port (853 by default).

  --dot-tls-servername STR, $DEMERGI_DOT_TLS_SERVERNAME
  The server name to check in the DoT server certificate (unspecified by
  default).

  --dot-tls-pin STR, $DEMERGI_DOT_TLS_PIN
  The pin to check in the DoT server certificate. The pin must be a base64
  encoded SHA256 hash of the public key (unspecified by default).

HTTPS:
  --https-clienthello-size NUM, $DEMERGI_HTTPS_CLIENTHELLO_SIZE
  The maximum chunk size in bytes for the ClientHello packet. A less than 1
  value disables fragmentation (40 by default).

  --https-clienthello-tlsv STR, $DEMERGI_HTTPS_CLIENTHELLO_TLSV
  The TLS protocol version to set in the ClientHello packet, valid values are
  "1.0", "1.1", "1.2" and "1.3" ("1.3" by default).

HTTP:
  --http-newline-separator STR, $DEMERGI_HTTP_NEWLINE_SEPARATOR
  The string to use to separate new lines ("\r\n" by default).

  --http-method-separator STR, $DEMERGI_HTTP_METHOD_SEPARATOR
  The string to use to separate the HTTP method from the target (" " by
  default).

  --http-target-separator STR, $DEMERGI_HTTP_TARGET_SEPARATOR
  The string to use to separate the target from the HTTP version (" " by
  default).

  --http-host-header-separator STR, $DEMERGI_HTTP_HOST_HEADER_SEPARATOR
  The string to use to separate the host header key from its value (":" by
  default).

  --http-mix-host-header-case BOOL, $DEMERGI_HTTP_MIX_HOST_HEADER_CASE
  Alternate upper and lower case in the host header (true by default).

Info:
  -v, --version
  Show version and quit.

  -h, --help
  Show this help and quit.
```

## Docker

#### [Docker Hub](https://hub.docker.com/r/hectorm/demergi/tags):
```sh
docker run -p 8080:8080 docker.io/hectorm/demergi:latest
```

#### [GitHub Container Registry](https://github.com/hectorm/demergi/pkgs/container/demergi):
```sh
docker run -p 8080:8080 ghcr.io/hectorm/demergi:latest
```

## License

[MIT License](./LICENSE.md) © [Héctor Molinero Fernández](https://hector.molinero.dev/).
