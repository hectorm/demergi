import net from "net";
import { URL } from "url";
import { DemergiResolver } from "./resolver.js";

export class DemergiProxy {
  #methods = new Set([
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

  constructor({
    host = "::",
    port = 8080,
    httpsClientHelloSize = 40,
    httpNewlineSeparator = "\r\n",
    httpMethodSeparator = " ",
    httpTargetSeparator = " ",
    httpHostHeaderSeparator = ":",
    httpMixHostHeaderCase = true,
    resolver = new DemergiResolver(),
  } = {}) {
    this.host = host;
    this.port = port;
    this.httpsClientHelloSize = httpsClientHelloSize;
    this.httpNewlineSeparator = this.#unescape(httpNewlineSeparator);
    this.httpMethodSeparator = this.#unescape(httpMethodSeparator);
    this.httpTargetSeparator = this.#unescape(httpTargetSeparator);
    this.httpHostHeaderSeparator = this.#unescape(httpHostHeaderSeparator);
    this.httpMixHostHeaderCase = httpMixHostHeaderCase;
    this.resolver = resolver;
    this.sockets = new Set();

    this.server = net.createServer((clientSocket) => {
      this.sockets.add(clientSocket);

      clientSocket.once("data", async (clientFirstData) => {
        clientSocket.pause();

        const requestLine = this.#getLine(clientFirstData, 0);
        if (requestLine === null) {
          console.error(
            `Received an empty request from client ${clientSocket.remoteAddress}`
          );
          this.#closeSocket(clientSocket);
          return;
        }

        const requestTokens = this.#getTokens(
          requestLine.data,
          [0x09, 0x20],
          3
        );
        if (requestTokens.length !== 3) {
          console.error(
            `Received an invalid request from client ${clientSocket.remoteAddress}`
          );
          this.#closeSocket(clientSocket);
          return;
        }

        const clientMethod = requestTokens[0].toString("utf8");
        const clientTarget = requestTokens[1].toString("utf8");
        const clientHttpVersion = requestTokens[2].toString("utf8");
        if (!this.#methods.has(clientMethod)) {
          console.error(
            `Received a request with an unsupported method from client ${clientSocket.remoteAddress}`
          );
          this.#closeSocket(clientSocket);
          return;
        }

        const isHTTPS = clientMethod === "CONNECT";

        let upstreamURL;
        try {
          upstreamURL = new URL(
            isHTTPS ? `https://${clientTarget}` : clientTarget
          );
        } catch (error) {
          console.error(
            `Exception occurred while processing a request from client ${clientSocket.remoteAddress}:`,
            error.message
          );
          this.#closeSocket(clientSocket);
          return;
        }

        let upstreamAddr;
        try {
          upstreamAddr =
            net.isIP(upstreamURL.hostname) === 0
              ? await this.resolver.resolve(upstreamURL.hostname)
              : upstreamURL.hostname;
        } catch (error) {
          console.error(
            `Exception occurred while processing a request from client ${clientSocket.remoteAddress}:`,
            error.message
          );
          this.#closeSocket(clientSocket);
          return;
        }

        let upstreamPort;
        if (upstreamURL.port.length > 0) {
          upstreamPort = Number.parseInt(upstreamURL.port, 10);
        } else {
          upstreamPort = isHTTPS ? 443 : 80;
        }

        const upstreamSocket = net.createConnection({
          host: upstreamAddr,
          port: upstreamPort,
        });
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

        if (isHTTPS) {
          clientSocket.once("data", (clientHello) => {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            try {
              if (this.httpsClientHelloSize > 0) {
                const chunkSize = this.httpsClientHelloSize;
                for (let i = 0; i < clientHello.length; i += chunkSize) {
                  upstreamSocket.write(clientHello.subarray(i, i + chunkSize));
                }
              } else {
                upstreamSocket.write(clientHello);
              }
            } catch (error) {
              console.error(
                `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}:`,
                error.message
              );
              this.#closeSocket(upstreamSocket);
              return;
            }
          });

          try {
            clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          } catch (error) {
            console.error(
              `Exception occurred while sending data to client ${clientSocket.remoteAddress}:`,
              error.message
            );
            this.#closeSocket(clientSocket);
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
          let nextLine = this.#getLine(clientFirstData, nextOffset);
          while (nextLine !== null) {
            const nextTokens = this.#getTokens(
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
            nextLine = this.#getLine(clientFirstData, nextOffset);
          }

          try {
            upstreamSocket.write(clientData);
          } catch (error) {
            console.error(
              `Exception occurred while sending data to upstream ${upstreamSocket.remoteAddress}:`,
              error.message
            );
            this.#closeSocket(upstreamSocket);
            return;
          }
        }

        clientSocket.resume();
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, (error) => {
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

  #getLine(buf, offset = 0) {
    const sol = offset;
    const eol = buf.indexOf(0x0a, sol);
    if (eol > 0) {
      const data = buf.subarray(sol, buf[eol - 1] === 0x0d ? eol - 1 : eol);
      const size = eol - sol + 1;
      return { data, size };
    }
    return null;
  }

  #getTokens(buf, separators, limit = -1, offset = 0) {
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

  #closeSocket(socket) {
    if (socket && !socket.destroyed) socket.destroy();
  }
}
