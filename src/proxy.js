import net from "node:net";
import tls from "node:tls";
import { DemergiResolver } from "./resolver.js";
import { Logger } from "./logger.js";
import {
  ProxyClientWriteError,
  ProxyRequestError,
  ProxyRequestHTTPVersionError,
  ProxyRequestMethodError,
  ProxyRequestTargetError,
  ProxyTLSVersionError,
  ProxyUpstreamConnectError,
  ProxyUpstreamWriteError,
  ResolverNoAddressError,
} from "./errors.js";

export class DemergiProxy {
  #addrs = [];
  #httpVersions = new Set(["HTTP/1.0", "HTTP/1.1"]);
  #httpMethods = new Set([
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
  ]);
  #tlsVersions = new Map([
    ["1.0", 0x0301],
    ["1.1", 0x0302],
    ["1.2", 0x0303],
    ["1.3", 0x0304],
  ]);

  constructor({
    addrs = ["[::]:8080"],
    hosts = [],
    tlsCa,
    tlsKey,
    tlsCert,
    inactivityTimeout = 60000,
    happyEyeballs = false,
    happyEyeballsTimeout = 250,
    httpsClientHelloSize = 40,
    httpsClientHelloTLSv = "1.3",
    httpNewlineSeparator = "\r\n",
    httpMethodSeparator = " ",
    httpTargetSeparator = " ",
    httpHostHeaderSeparator = ":",
    httpMixHostHeaderCase = true,
    resolver = new DemergiResolver(),
  } = {}) {
    this.#addrs = addrs.map((addr) => {
      return new URL(
        /^[a-z0-9.+-]+:\/\//i.test(addr) ? addr : `http://${addr}`,
      );
    });

    this.hosts = new Set(hosts);

    this.tlsCa = tlsCa;
    this.tlsKey = tlsKey;
    this.tlsCert = tlsCert;

    this.inactivityTimeout = inactivityTimeout;
    this.happyEyeballs = happyEyeballs;
    this.happyEyeballsTimeout = happyEyeballsTimeout;

    this.httpsClientHelloSize = httpsClientHelloSize;
    if (this.#tlsVersions.has(httpsClientHelloTLSv)) {
      this.httpsClientHelloTLSv = this.#tlsVersions.get(httpsClientHelloTLSv);
    } else {
      throw new ProxyTLSVersionError(httpsClientHelloTLSv);
    }

    this.httpNewlineSeparator = this.#unescape(httpNewlineSeparator);
    this.httpMethodSeparator = this.#unescape(httpMethodSeparator);
    this.httpTargetSeparator = this.#unescape(httpTargetSeparator);
    this.httpHostHeaderSeparator = this.#unescape(httpHostHeaderSeparator);
    this.httpMixHostHeaderCase = httpMixHostHeaderCase;

    this.resolver = resolver;

    this.servers = new Set();
    this.sockets = new Set();
  }

  async start() {
    for (const addr of this.#addrs) {
      const isHttps = addr.protocol === "https:";
      const host = addr.hostname.match(/^\[(.+)\]$/)?.[1] ?? addr.hostname;
      const port = addr.port
        ? Number.parseInt(addr.port, 10)
        : isHttps
          ? 443
          : 80;

      let server;
      if (isHttps) {
        server = tls.createServer(
          {
            ca: this.tlsCa,
            key: this.tlsKey,
            cert: this.tlsCert,
            ALPNProtocols: ["http/1.1"],
            requestCert: this.tlsCa !== undefined,
          },
          this.#connectionListener,
        );

        server.on("tlsClientError", (error, socket) => {
          this.#socketDestroy(socket);
          this.#socketErrorHandler(error);
        });
      } else {
        server = net.createServer(this.#connectionListener);
      }

      this.servers.add(server);
      server.once("close", () => this.servers.delete(server));

      await new Promise((resolve, reject) => {
        server.once("listening", () => resolve());
        server.once("error", (error) => reject(error));
        server.listen(port, host);
      });
    }

    return this.servers;
  }

  async stop() {
    for (const socket of this.sockets) {
      this.#socketDestroy(socket);
    }

    for (const server of this.servers) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  #connectionListener = (clientSocket) => {
    const upstreamSocket = new net.Socket();

    this.sockets.add(clientSocket);
    this.sockets.add(upstreamSocket);

    clientSocket.setTimeout(this.inactivityTimeout);
    upstreamSocket.setTimeout(this.inactivityTimeout);

    clientSocket.once("timeout", () => {
      this.#socketTimeoutHandler(clientSocket, upstreamSocket);
    });
    upstreamSocket.once("timeout", () => {
      this.#socketTimeoutHandler(upstreamSocket, clientSocket);
    });

    clientSocket.once("close", () => {
      this.#socketCloseHandler(clientSocket, upstreamSocket);
    });
    upstreamSocket.once("close", () => {
      this.#socketCloseHandler(upstreamSocket, clientSocket);
    });

    clientSocket.once("error", (error) => {
      this.#socketErrorHandler(error);
    });
    upstreamSocket.once("error", (error) => {
      this.#socketErrorHandler(error);
    });

    clientSocket.once("data", (firstData) => {
      clientSocket.pause();

      const requestLine = this.#readLine(firstData, 0);
      if (requestLine.data === undefined) {
        this.#socketDestroy(clientSocket, new ProxyRequestError(clientSocket));
        return;
      }

      const requestTokens = this.#tokenize(requestLine.data, [0x09, 0x20], 3);
      if (requestTokens.length !== 3) {
        this.#socketDestroy(clientSocket, new ProxyRequestError(clientSocket));
        return;
      }

      const httpMethod = requestTokens[0].toString("utf8");
      if (!this.#httpMethods.has(httpMethod)) {
        this.#socketDestroy(
          clientSocket,
          new ProxyRequestMethodError(clientSocket),
        );
        return;
      }
      const isHttps = httpMethod === "CONNECT";

      const target = requestTokens[1].toString("utf8");
      let { host, port } = this.#parseOrigin(target);
      if (host === undefined) {
        this.#socketDestroy(
          clientSocket,
          new ProxyRequestTargetError(clientSocket),
        );
        return;
      }
      if (port === undefined) {
        port = isHttps ? 443 : 80;
      }
      const mustObfuscate = this.hosts.size === 0 || this.hosts.has(host);

      const httpVersion = requestTokens[2].toString("utf8");
      if (!this.#httpVersions.has(httpVersion)) {
        this.#socketDestroy(
          clientSocket,
          new ProxyRequestHTTPVersionError(clientSocket),
        );
        return;
      }

      try {
        Logger.debug(`Connecting to upstream ${host}:${port}`);
        upstreamSocket.connect({
          host,
          port,
          autoSelectFamily: this.happyEyeballs,
          autoSelectFamilyAttemptTimeout: this.happyEyeballsTimeout,
          lookup: (hostname, options, callback) => {
            this.resolver.resolve(hostname).then(
              (answer) => {
                if (options?.all) {
                  callback(null, answer);
                } else {
                  // If Happy Eyeballs is disabled, prefer IPv4.
                  const { address, family } =
                    answer.find(({ family }) => family === 4) ??
                    answer.find(({ family }) => family === 6);
                  callback(null, address, family);
                }
              },
              (error) => callback(error),
            );
          },
        });
      } catch (error) {
        this.#socketDestroy(
          clientSocket,
          new ProxyUpstreamConnectError(upstreamSocket, error),
        );
        return;
      }

      if (isHttps) {
        if (mustObfuscate) {
          clientSocket.once("data", (connData) => {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            const isHandshake = connData.readUInt8(0) === 0x16;

            if (isHandshake) {
              connData.writeUInt16BE(this.httpsClientHelloTLSv, 1);
            }

            try {
              if (isHandshake && this.httpsClientHelloSize > 0) {
                const size = this.httpsClientHelloSize;
                for (let i = 0; i < connData.length; i += size) {
                  upstreamSocket.write(connData.subarray(i, i + size));
                }
              } else {
                upstreamSocket.write(connData);
              }
            } catch (error) {
              this.#socketDestroy(
                upstreamSocket,
                new ProxyUpstreamWriteError(upstreamSocket, error),
              );
              return;
            }
          });
        } else {
          upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);
        }

        try {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        } catch (error) {
          this.#socketDestroy(
            clientSocket,
            new ProxyClientWriteError(clientSocket, error),
          );
          return;
        }
      } else {
        upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

        let firstDataOffset = 0;

        if (mustObfuscate) {
          let headerData =
            httpMethod +
            this.httpMethodSeparator +
            target +
            this.httpTargetSeparator +
            httpVersion +
            this.httpNewlineSeparator;

          firstDataOffset += requestLine.size;

          let nextLine = this.#readLine(firstData, firstDataOffset);
          while (nextLine.data !== undefined) {
            // Break loop when the request header ends.
            if (nextLine.data.byteLength === 0) break;

            const firstHostBytes = nextLine.data.subarray(0, 5);
            if (firstHostBytes.toString("utf8").toLowerCase() === "host:") {
              const hostKey = "Host";
              const hostVal = nextLine.data.subarray(5).toString("utf8").trim();
              headerData +=
                (this.httpMixHostHeaderCase
                  ? this.#mixCase(hostKey)
                  : hostKey) +
                this.httpHostHeaderSeparator +
                hostVal +
                this.httpNewlineSeparator;
            } else {
              const data = nextLine.data.toString("utf8");
              headerData += data + this.httpNewlineSeparator;
            }

            firstDataOffset += nextLine.size;
            nextLine = this.#readLine(firstData, firstDataOffset);
          }

          try {
            upstreamSocket.write(headerData);
          } catch (error) {
            this.#socketDestroy(
              upstreamSocket,
              new ProxyUpstreamWriteError(upstreamSocket, error),
            );
            return;
          }
        }

        try {
          upstreamSocket.write(firstData.subarray(firstDataOffset));
        } catch (error) {
          this.#socketDestroy(
            upstreamSocket,
            new ProxyUpstreamWriteError(upstreamSocket, error),
          );
          return;
        }
      }

      clientSocket.resume();
    });
  };

  #socketDestroy(socket, error) {
    if (socket && !socket.destroyed) {
      if (socket.connecting) {
        socket.once("connect", () => socket.destroy(error));
      } else {
        socket.destroy(error);
      }
    }
  }

  #socketTimeoutHandler(...args) {
    this.#socketCloseHandler(...args);
  }

  #socketCloseHandler(socket, relatedSocket) {
    this.sockets.delete(socket);
    this.#socketDestroy(relatedSocket);
  }

  #socketErrorHandler(error) {
    if (error instanceof ResolverNoAddressError) {
      Logger.debug(error.message);
    } else if (error.message?.length > 0) {
      if (error.code === "ENETUNREACH") {
        Logger.error(error.message);
      } else if (error.code !== "ECONNRESET" && error.code !== "EPIPE") {
        Logger.error(error);
      }
    }
  }

  #readLine(buf, offset = 0) {
    let data;
    let size;
    const sol = offset;
    const eol = buf.indexOf(0x0a, sol);
    if (eol > 0) {
      data = buf.subarray(sol, buf[eol - 1] === 0x0d ? eol - 1 : eol);
      size = eol - sol + 1;
    } else if (offset < buf.byteLength) {
      data = buf.subarray(offset);
      size = data.byteLength;
    }
    return { data, size };
  }

  #tokenize(buf, separators, limit = -1, offset = 0) {
    const tokens = [];
    let sot = offset;
    let eot = -1;
    for (let i = offset; i < buf.length; i++) {
      if (separators.includes(buf[i])) {
        if (sot <= eot) {
          if (limit > -1 && limit <= tokens.length) break;
          tokens.push(buf.subarray(sot, eot + 1));
        }
        sot = i + 1;
        eot = -1;
      } else {
        eot = i;
      }
    }
    if (sot < buf.length) {
      tokens.push(buf.subarray(sot));
    }
    return tokens;
  }

  #parseOrigin(origin) {
    let host;
    let port;
    const match = origin.match(
      // Extracts the hostname (also IPv4 or IPv6 address)
      // and port of a URL with or without protocol.
      /^(?:[a-z0-9.+-]+:\/\/)?(?:\[?([^/]+?)\]?)(?::([0-9]+))?(?:\/.*)?$/i,
    );
    if (match !== null) {
      if (match[1] !== undefined) host = match[1].toLowerCase();
      if (match[2] !== undefined) port = Number.parseInt(match[2], 10);
    }
    return { host, port };
  }

  #mixCase(str) {
    let mstr = "";
    for (let i = 0; i < str.length; i++) {
      mstr += i % 2 === 0 ? str[i].toLowerCase() : str[i].toUpperCase();
    }
    return mstr;
  }

  #unescape(str) {
    return str
      .replace(/\\0/g, "\0")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\v/g, "\v");
  }
}
