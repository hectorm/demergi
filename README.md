[![Last version](https://img.shields.io/github/v/release/hectorm/demergi?label=version)](https://github.com/hectorm/demergi/releases)
[![Docker image size](https://img.shields.io/docker/image-size/hectorm/demergi/latest?label=docker%20image%20size)](https://hub.docker.com/r/hectorm/demergi/tags)
[![License](https://img.shields.io/github/license/hectorm/demergi?label=license)](./LICENSE.md)

---

# Demergi

A zero dependency proxy server that helps to bypass the Deep Packet Inspection (DPI) systems implemented by [various ISPs](./ISP.md).

## How does it work?

Although traffic over an HTTPS connection is encrypted, the client and server exchange some information during the initial TLS handshake to negotiate the encryption. In this initial handshake, the client sends the name of the server it is contacting in clear text (ClientHello packet) so that the server knows which certificate to provide. Deep Packet Inspection (DPI) systems can intercept this communication and block the connection. To avoid detection, Demergi fragments and modifies this initial packet.

There are promising solutions to the problem of hiding as much information as possible in the initial handshake of a TLS connection, one being [Encrypted Client Hello (ECH)](https://datatracker.ietf.org/doc/html/draft-ietf-tls-esni). However, until these solutions are fully deployed, tools such as Demergi can be useful as evasion mechanisms.

To learn more about how a TLS connection works, I recommend these excellent resources:

- [The Illustrated TLS 1.2 Connection](https://tls12.xargs.org).
- [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org).

For HTTP traffic, Demergi also modifies the packet header to make interception more difficult, but as the traffic is not encrypted, this should be avoided where possible.

> [!WARNING]
> Demergi **should not be used as a replacement for a VPN** if you are concerned about the consequences of your traffic being detected, as the techniques used are not infallible, but are good enough to access blocked content from your own network without the need for a VPN.

## How do I use it?

Demergi is an HTTP/HTTPS proxy server designed to be deployed within the network where traffic is being blocked. Either on the device you wish to access the content from or on a network appliance.

Simply deploy it and adjust the proxy settings of your browser or other software to connect through Demergi.

### Command line

You can install Demergi with npm:

```sh
npm install -g demergi
```

Or directly download the latest version from the releases section.

> [!NOTE]
> If you want to install it as a service, you can use [the following systemd unit](./systemd/demergi.service) as a reference. On macOS, you use the [launchd system](./launchctl/README.md) to run as background service.

Once installed, you can run it with the `demergi` command.

```
$ demergi --help
Usage: demergi [OPTION]...

A proxy server that helps to bypass the DPI systems implemented by various ISPs.

Proxy:
  -A, --addrs STR, $DEMERGI_ADDRS
  The address list separated by commas or spaces to bind the server to
  ("[::]:8080" by default).

  -H, --hosts STR, $DEMERGI_HOSTS
  The host list separated by commas or spaces to apply the evasion techniques,
  will be applied to all hosts if unspecified (unspecified by default).

  -W, --workers NUM, $DEMERGI_WORKERS
  The number of workers (0 by default).

  --tls-ca STR, $DEMERGI_TLS_CA
  Path to the TLS certificate bundle used to verify the client identity
  (unspecified by default).

  --tls-key STR, $DEMERGI_TLS_KEY
  Path to the server TLS key (unspecified by default).

  --tls-cert STR, $DEMERGI_TLS_CERT
  Path to the server TLS certificate (unspecified by default).

  --inactivity-timeout NUM, $DEMERGI_INACTIVITY_TIMEOUT
  Maximum time in ms before the connection is closed due to inactivity
  (60000 by default).

  --happy-eyeballs BOOL, $DEMERGI_HAPPY_EYEBALLS
  Enable Happy Eyeballs algorithm (RFC 8305) (EXPERIMENTAL) (false by default).

  --happy-eyeballs-timeout NUM, $DEMERGI_HAPPY_EYEBALLS_TIMEOUT
  Maximum time in ms for IPv6 before trying IPv4 (250 by default).

Resolver:
  --dns-mode STR, $DEMERGI_DNS_MODE
  The DNS resolver mode, valid values are "plain", "doh" and "dot" ("doh" by
  default).

  --dns-cache-size NUM, $DEMERGI_DNS_CACHE_SIZE
  The maximum number of entries in the DNS cache (100000 by default).

  --doh-url STR, $DEMERGI_DOH_URL
  The DoH server URL ("https://1.0.0.1/dns-query" by default).

  --doh-tls-servername STR, $DEMERGI_DOH_TLS_SERVERNAME
  The server name to check in the DoH server certificate (unspecified by
  default).

  --doh-tls-pin STR, $DEMERGI_DOH_TLS_PIN
  The pin to check in the DoH server certificate. The pin must be a base64
  encoded SHA256 hash of the public key (unspecified by default).

  --dot-server STR, $DEMERGI_DOT_SERVER
  The DoT server host and optionally port ("1.0.0.1" by default).

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
  -l, --log-level STR, $DEMERGI_LOG_LEVEL
  The log level, valid values are "debug", "info", "warn", "error" and "none"
  ("info" by default).

  -v, --version
  Show version and quit.

  -h, --help
  Show this help and quit.
```

### Docker/Podman

Demergi is also distributed in container images. The default behaviour can be changed using environment variables or container arguments.

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
