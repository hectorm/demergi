import net from "net";
import { DemergiResolver } from "./resolver.js";

export class DemergiProxy {
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
    addr = "::",
    port = 8080,
    hostList = [],
    httpsClientHelloSize = 40,
    httpsClientHelloTLSv = "1.3",
    httpNewlineSeparator = "\r\n",
    httpMethodSeparator = " ",
    httpTargetSeparator = " ",
    httpHostHeaderSeparator = ":",
    httpMixHostHeaderCase = true,
    resolver = new DemergiResolver(),
  } = {}) {
    this.addr = addr;
    this.port = port;
    this.hostList = new Set(hostList.map((h) => this.#splitOrigin(h)[0]));
    this.httpsClientHelloSize = httpsClientHelloSize;
    this.httpsClientHelloTLSv = this.#tlsVersions.get(httpsClientHelloTLSv);
    this.httpNewlineSeparator = this.#unescape(httpNewlineSeparator);
    this.httpMethodSeparator = this.#unescape(httpMethodSeparator);
    this.httpTargetSeparator = this.#unescape(httpTargetSeparator);
    this.httpHostHeaderSeparator = this.#unescape(httpHostHeaderSeparator);
    this.httpMixHostHeaderCase = httpMixHostHeaderCase;
    this.resolver = resolver;
    this.sockets = new Set();

    if (this.httpsClientHelloTLSv === undefined) {
      throw new Error(`Unsupported TLS version ${httpsClientHelloTLSv}`);
    }

    this.server = net.createServer((clientSocket) => {
      this.sockets.add(clientSocket);

      clientSocket.once("data", async (clientFirstData) => {
        clientSocket.pause();

        const requestLine = this.#readLine(clientFirstData, 0);
        if (requestLine === null) {
          this.#closeSocket(
            clientSocket,
            `Received an empty request line from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const requestTokens = this.#tokenize(requestLine.data, [0x09, 0x20], 3);
        if (requestTokens.length !== 3) {
          this.#closeSocket(
            clientSocket,
            `Received an invalid request line from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const clientMethod = requestTokens[0].toString("utf8");
        const clientTarget = requestTokens[1].toString("utf8");
        const clientHttpVersion = requestTokens[2].toString("utf8");
        if (!this.#httpMethods.has(clientMethod)) {
          this.#closeSocket(
            clientSocket,
            `Received an unsupported method from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const isHTTPS = clientMethod === "CONNECT";

        const upstreamOrigin = this.#splitOrigin(clientTarget);
        const upstreamHost = upstreamOrigin[0];
        const upstreamPort = upstreamOrigin[1] || (isHTTPS ? 443 : 80);
        if (!upstreamHost || !upstreamPort) {
          this.#closeSocket(
            clientSocket,
            `Received an invalid target from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        let upstreamAddr;
        try {
          upstreamAddr =
            net.isIP(upstreamHost) === 0
              ? await this.resolver.resolve(upstreamHost)
              : upstreamHost;
        } catch (error) {
          this.#closeSocket(
            clientSocket,
            `Exception occurred while resolving target for client ${clientSocket.remoteAddress}: ${error.message}`
          );
          return;
        }

        const upstreamSocket = new net.Socket();
        this.sockets.add(upstreamSocket);

        upstreamSocket.on("close", () => {
          this.sockets.delete(upstreamSocket);
          this.#closeSocket(clientSocket);
        });

        upstreamSocket.on("error", () => {
          this.#closeSocket(upstreamSocket);
        });

        clientSocket.on("close", () => {
          this.sockets.delete(clientSocket);
          this.#closeSocket(upstreamSocket);
        });

        clientSocket.on("error", () => {
          this.#closeSocket(clientSocket);
        });

        try {
          upstreamSocket.connect({
            host: upstreamAddr,
            port: upstreamPort,
            lookup: (_, __, cb) => cb(),
          });
        } catch (error) {
          this.#closeSocket(
            clientSocket,
            `Exception occurred while creating upstream socket for client ${clientSocket.remoteAddress}: ${error.message}`
          );
          return;
        }

        if (this.hostList.size === 0 || this.hostList.has(upstreamHost)) {
          if (isHTTPS) {
            clientSocket.once("data", (clientHello) => {
              upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

              clientHello.writeUInt16BE(this.httpsClientHelloTLSv, 1);

              try {
                if (this.httpsClientHelloSize > 0) {
                  const size = this.httpsClientHelloSize;
                  for (let i = 0; i < clientHello.length; i += size) {
                    upstreamSocket.write(clientHello.subarray(i, i + size));
                  }
                } else {
                  upstreamSocket.write(clientHello);
                }
              } catch (error) {
                this.#closeSocket(
                  upstreamSocket,
                  `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}: ${error.message}`
                );
                return;
              }
            });

            try {
              clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            } catch (error) {
              this.#closeSocket(
                clientSocket,
                `Exception occurred while sending data to client ${clientSocket.remoteAddress}: ${error.message}`
              );
              return;
            }
          } else {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            let clientData =
              clientMethod +
              this.httpMethodSeparator +
              clientTarget +
              this.httpTargetSeparator +
              clientHttpVersion +
              this.httpNewlineSeparator;

            let nextOffset = requestLine.size;
            let nextLine = this.#readLine(clientFirstData, nextOffset);
            while (nextLine !== null) {
              const nextTokens = this.#tokenize(
                nextLine.data,
                [0x09, 0x20, 0x3a],
                1
              );
              if (nextTokens.length === 2) {
                const key = nextTokens[0].toString("utf8");
                const val = nextTokens[1].toString("utf8");
                if (key.toLowerCase() === "host") {
                  clientData +=
                    (this.httpMixHostHeaderCase ? this.#mixCase(key) : key) +
                    this.httpHostHeaderSeparator +
                    (this.httpMixHostHeaderCase ? this.#mixCase(val) : val) +
                    this.httpNewlineSeparator;
                } else {
                  clientData += key + ": " + val + this.httpNewlineSeparator;
                }
              } else {
                const val = nextLine.data.toString("utf8");
                clientData += val + this.httpNewlineSeparator;
              }
              nextOffset += nextLine.size;
              nextLine = this.#readLine(clientFirstData, nextOffset);
            }

            try {
              upstreamSocket.write(clientData);
            } catch (error) {
              this.#closeSocket(
                upstreamSocket,
                `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}: ${error.message}`
              );
              return;
            }
          }
        } else {
          if (isHTTPS) {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            try {
              clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            } catch (error) {
              this.#closeSocket(
                clientSocket,
                `Exception occurred while sending data to client ${clientSocket.remoteAddress}: ${error.message}`
              );
              return;
            }
          } else {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            try {
              upstreamSocket.write(clientFirstData);
            } catch (error) {
              this.#closeSocket(
                upstreamSocket,
                `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}: ${error.message}`
              );
              return;
            }
          }
        }

        clientSocket.resume();
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.addr, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      for (let socket of this.sockets) this.#closeSocket(socket);
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  #readLine(buf, offset = 0) {
    const sol = offset;
    const eol = buf.indexOf(0x0a, sol);
    if (eol > 0) {
      const data = buf.subarray(sol, buf[eol - 1] === 0x0d ? eol - 1 : eol);
      const size = eol - sol + 1;
      return { data, size };
    }
    return null;
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

  #splitOrigin(origin) {
    const match = origin.match(
      // Extracts the hostname (also IPv4 or IPv6 address)
      // and port of a URL with or without protocol.
      /^(?:[a-z0-9.+-]+:\/\/)?(?:\[?([^/]*?)\]?)(?::([0-9]+))?(?:\/.*)?$/i
    );
    return match !== null
      ? [match[1].toLowerCase(), Number.parseInt(match[2], 10)]
      : [];
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

  #closeSocket(socket, reason) {
    if (socket && !socket.destroyed) socket.destroy();
    if (reason) console.error(reason);
  }
}
