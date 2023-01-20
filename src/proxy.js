import net from "node:net";
import { DemergiResolver } from "./resolver.js";

export class DemergiProxy {
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
    this.hostList = new Set(hostList.map((e) => this.#parseOrigin(e).host));
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

      const upstreamSocket = new net.Socket();
      this.sockets.add(upstreamSocket);

      upstreamSocket.on("close", () => {
        this.sockets.delete(upstreamSocket);
        this.#closeSocket(clientSocket);
      });

      upstreamSocket.on("error", (error) => {
        if (error.code !== "ECONNRESET" && error.code !== "EPIPE") {
          console.error(error.message);
        }
      });

      clientSocket.on("close", () => {
        this.sockets.delete(clientSocket);
        this.#closeSocket(upstreamSocket);
      });

      clientSocket.on("error", (error) => {
        if (error.code !== "ECONNRESET" && error.code !== "EPIPE") {
          console.error(error.message);
        }
      });

      clientSocket.once("data", async (clientFirstData) => {
        clientSocket.pause();

        const requestLine = this.#readLine(clientFirstData, 0);
        if (requestLine.data === undefined) {
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
        if (!this.#httpMethods.has(clientMethod)) {
          this.#closeSocket(
            clientSocket,
            `Received an unsupported method from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const clientTarget = requestTokens[1].toString("utf8");
        const upstreamOrigin = this.#parseOrigin(clientTarget);
        if (upstreamOrigin.host === undefined) {
          this.#closeSocket(
            clientSocket,
            `Received an invalid target from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const clientHttpVersion = requestTokens[2].toString("utf8");
        if (!this.#httpVersions.has(clientHttpVersion)) {
          this.#closeSocket(
            clientSocket,
            `Received an unsupported HTTP version from client ${clientSocket.remoteAddress}`
          );
          return;
        }

        const isConnect = clientMethod === "CONNECT";

        try {
          upstreamSocket.connect({
            host: upstreamOrigin.host,
            port: upstreamOrigin.port || (isConnect ? 443 : 80),
            autoSelectFamily: true,
            lookup: (hostname, options, callback) => {
              this.resolver.resolve(hostname).then(
                (response) => {
                  if (options?.all) {
                    callback(null, response);
                  } else {
                    // If Node.js doesn't implement the Happy Eyeballs
                    // algorithm, fall back to prefer IPv4.
                    const { address, family } =
                      response.find(({ family }) => family === 4) ??
                      response.find(({ family }) => family === 6);
                    callback(null, address, family);
                  }
                },
                (error) => callback(error)
              );
            },
          });
        } catch (error) {
          this.#closeSocket(
            clientSocket,
            `Exception occurred while creating upstream socket for client ${clientSocket.remoteAddress}: ${error.message}`
          );
          return;
        }

        if (
          this.hostList.size === 0 ||
          this.hostList.has(upstreamOrigin.host)
        ) {
          if (isConnect) {
            clientSocket.once("data", (clientConnData) => {
              upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

              const isHandshake = clientConnData.readUInt8(0) === 0x16;

              if (isHandshake) {
                clientConnData.writeUInt16BE(this.httpsClientHelloTLSv, 1);
              }

              try {
                if (isHandshake && this.httpsClientHelloSize > 0) {
                  const size = this.httpsClientHelloSize;
                  for (let i = 0; i < clientConnData.length; i += size) {
                    upstreamSocket.write(clientConnData.subarray(i, i + size));
                  }
                } else {
                  upstreamSocket.write(clientConnData);
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

            let clientHeaderData =
              clientMethod +
              this.httpMethodSeparator +
              clientTarget +
              this.httpTargetSeparator +
              clientHttpVersion +
              this.httpNewlineSeparator;

            let nextOffset = requestLine.size;
            let nextLine = this.#readLine(clientFirstData, nextOffset);
            while (nextLine.data !== undefined) {
              // Break loop when the request header ends.
              if (nextLine.data.byteLength === 0) break;

              const firstHostBytes = nextLine.data.subarray(0, 5);
              if (firstHostBytes.toString("utf8").toLowerCase() === "host:") {
                const hostKey = "Host";
                const hostVal = nextLine.data
                  .subarray(5)
                  .toString("utf8")
                  .trim();
                clientHeaderData +=
                  (this.httpMixHostHeaderCase
                    ? this.#mixCase(hostKey)
                    : hostKey) +
                  this.httpHostHeaderSeparator +
                  hostVal +
                  this.httpNewlineSeparator;
              } else {
                const data = nextLine.data.toString("utf8");
                clientHeaderData += data + this.httpNewlineSeparator;
              }

              nextOffset += nextLine.size;
              nextLine = this.#readLine(clientFirstData, nextOffset);
            }

            try {
              upstreamSocket.write(clientHeaderData);
              upstreamSocket.write(clientFirstData.subarray(nextOffset));
            } catch (error) {
              this.#closeSocket(
                upstreamSocket,
                `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}: ${error.message}`
              );
              return;
            }
          }
        } else {
          if (isConnect) {
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
      /^(?:[a-z0-9.+-]+:\/\/)?(?:\[?([^/]+?)\]?)(?::([0-9]+))?(?:\/.*)?$/i
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

  #closeSocket(socket, reason) {
    if (socket && !socket.destroyed) {
      socket.destroy(reason ? new Error(reason) : undefined);
    }
  }
}
