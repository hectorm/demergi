import net from "net";
import { URL } from "url";
import { DemergiResolver } from "./resolver.js";

export class DemergiProxy {
  constructor({
    host = "::",
    port = 8080,
    resolver = new DemergiResolver(),
  } = {}) {
    this.host = host;
    this.port = port;
    this.resolver = resolver;
    this.sockets = new Set();

    this.server = net.createServer((clientSocket) => {
      this.sockets.add(clientSocket);

      clientSocket.once("data", async (clientFirstData) => {
        clientSocket.pause();

        const requestLine = this.#parseRequestLine(clientFirstData);
        if (!requestLine) {
          this.#closeSocket(clientSocket);
          console.error("Invalid request");
          return;
        }

        const isHTTPS = requestLine.method === "CONNECT";

        let upstreamURL;
        try {
          upstreamURL = new URL(
            isHTTPS ? `https://${requestLine.target}` : requestLine.target
          );
        } catch (error) {
          this.#closeSocket(clientSocket);
          console.error(error.message);
          return;
        }

        let upstreamAddr;
        try {
          upstreamAddr =
            net.isIP(upstreamURL.hostname) === 0
              ? await this.resolver.resolve(upstreamURL.hostname)
              : upstreamURL.hostname;
        } catch (error) {
          this.#closeSocket(clientSocket);
          console.error(error.message);
          return;
        }

        let upstreamPort;
        if (upstreamURL.port.length > 0) {
          upstreamPort = upstreamURL.port;
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

        upstreamSocket.on("error", (error) => {
          this.#closeSocket(upstreamSocket);
          console.error(error.message);
        });

        clientSocket.on("close", () => {
          this.sockets.delete(clientSocket);
          this.#closeSocket(upstreamSocket);
        });

        clientSocket.on("error", (error) => {
          this.#closeSocket(clientSocket);
          console.error(error.message);
        });

        if (isHTTPS) {
          clientSocket.once("data", (clientHello) => {
            upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

            try {
              for (let i = 0; i < clientHello.length; i += 100) {
                const clientHelloChunk = clientHello.subarray(i, i + 100);
                upstreamSocket.write(clientHelloChunk);
              }
            } catch (error) {
              this.#closeSocket(upstreamSocket);
              console.error(error.message);
              return;
            }
          });

          try {
            clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          } catch (error) {
            this.#closeSocket(clientSocket);
            console.error(error.message);
            return;
          }
        } else {
          upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);

          try {
            const mixedTarget =
              this.#mixCase(upstreamURL.origin) +
              upstreamURL.pathname +
              upstreamURL.search;
            upstreamSocket.write(
              `${requestLine.method}  ${mixedTarget} ${requestLine.version}\r\n`
            );

            let sol = requestLine.length;
            let eol = clientFirstData.indexOf(0x0a, sol) + 1;
            while (eol > 0) {
              const line = clientFirstData.subarray(sol, eol);
              const match = line.toString("utf8").match(/^(.+?):\s*(.+)$/m);
              if (match && match[1].toUpperCase() === "HOST") {
                const mixedKey = this.#mixCase(match[1]);
                const mixedValue = this.#mixCase(match[2]);
                upstreamSocket.write(`${mixedKey}:${mixedValue}\r\n`);
              } else {
                upstreamSocket.write(line);
              }
              sol = eol;
              eol = clientFirstData.indexOf(0x0a, sol) + 1;
            }
          } catch (error) {
            this.#closeSocket(upstreamSocket);
            console.error(error.message);
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

  #parseRequestLine(buf) {
    const firstLineBuf = buf.subarray(0, buf.indexOf("\r\n", 0));
    const firstLineArr = firstLineBuf.toString().split(/\s+/);
    if (firstLineArr.length === 3) {
      return {
        method: firstLineArr[0],
        target: firstLineArr[1],
        version: firstLineArr[2],
        length: firstLineBuf.length + 2,
      };
    }
  }

  #mixCase(str) {
    let mstr = "";
    for (let i = 0; i < str.length; i++) {
      mstr += i % 2 === 0 ? str[i].toLowerCase() : str[i].toUpperCase();
    }
    return mstr;
  }

  #closeSocket(socket) {
    if (socket && !socket.destroyed) socket.destroy();
  }
}
