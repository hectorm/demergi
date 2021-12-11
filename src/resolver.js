import crypto from "crypto";
import dns from "dns";
import tls from "tls";
import { LRU } from "./lru.js";

export class DemergiResolver {
  constructor({
    dnsMode = "dot",
    dnsCacheSize = 100000,
    dotHost = "1.0.0.1",
    dotPort = 853,
    dotTlsServername,
    dotTlsPin,
  } = {}) {
    this.dnsMode = dnsMode;
    this.dnsCache = new LRU(dnsCacheSize);
    this.dotHost = dotHost;
    this.dotPort = dotPort;
    this.dotTlsServername = dotTlsServername;
    this.dotTlsPin = dotTlsPin;
  }

  async resolve(hostname, family = 4) {
    const cached = this.dnsCache.get(hostname);
    if (cached === undefined) {
      let resolved;
      switch (this.dnsMode) {
        case "plain":
          resolved = await this.#dnsResolve(hostname, family);
          break;
        case "dot":
          resolved = await this.#dotResolve(hostname, family);
          break;
        default:
          throw new Error(`Unknown DNS mode "${this.dnsMode}"`);
      }
      this.dnsCache.set(hostname, resolved.addr, resolved.ttl);
      return resolved.addr;
    }
    return cached;
  }

  #dnsResolve(hostname, family) {
    return new Promise((resolve, reject) => {
      const resolver = family === 6 ? dns.resolve6 : dns.resolve4;
      resolver(hostname, { ttl: true }, (error, addrs) => {
        if (error) reject(error);
        else resolve({ addr: addrs[0].address, ttl: addrs[0].ttl });
      });
    });
  }

  #dotResolve(hostname, family) {
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = tls.connect({
          host: this.dotHost,
          port: this.dotPort,
          servername: this.dotTlsServername,
          rejectUnauthorized:
            typeof this.dotTlsServername === "string" ||
            typeof this.dotTlsPin !== "string",
        });
      } catch (error) {
        reject(error);
        return;
      }

      const query = Buffer.from([
        // Length
        0x00,
        0x00,
        // ID
        ...crypto.randomBytes(2),
        // Flags
        0x01,
        0x00,
        // QDCOUNT
        0x00,
        0x01,
        // ANCOUNT
        0x00,
        0x00,
        // NSCOUNT
        0x00,
        0x00,
        // ARCOUNT
        0x00,
        0x00,
        // QNAME
        ...this.#encodeName(hostname),
        // QTYPE
        ...(family === 4 ? [0x00, 0x01] : []),
        ...(family === 6 ? [0x00, 0x1c] : []),
        // QCLASS
        0x00,
        0x01,
      ]);
      query.writeUInt16BE(query.byteLength - 2, 0);

      socket.on("secureConnect", () => {
        if (typeof this.dotTlsPin === "string") {
          const pubkey256 = this.#sha256(socket.getPeerCertificate().pubkey);
          if (this.dotTlsPin !== pubkey256) {
            socket.destroy();
            reject(
              new Error(
                [
                  "Certificate validation error, the public key does not match the pinned one",
                  `Expected: ${this.dotTlsPin}`,
                  `Received: ${pubkey256}`,
                ].join("\n")
              )
            );
            return;
          }
        }

        socket.write(query);
      });

      socket.on("data", (answer) => {
        socket.destroy();

        const length = answer.readUInt16BE(0);
        if (length !== answer.byteLength - 2) {
          reject(
            new Error(
              [
                "Unexpected response length",
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }
        // Strip length from answer.
        answer = answer.subarray(2);

        let offset = 0;

        const queryId = query.readUInt16BE(2);
        const answerId = answer.readUInt16BE(offset);
        if (answerId !== queryId) {
          reject(
            new Error(
              [
                "Received a different response ID",
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }

        const flags = answer.readUInt16BE((offset += 2));
        const qr = (flags >> 15) & 0x01;
        const opcode = (flags >> 11) & 0x0f;
        // const aa = (flags >> 10) & 0x01;
        const tc = (flags >> 9) & 0x01;
        // const rd = (flags >> 8) & 0x01;
        // const ra = (flags >> 7) & 0x01;
        // const z = (flags >> 6) & 0x01;
        // const ad = (flags >> 5) & 0x01;
        // const cd = (flags >> 4) & 0x01;
        if (qr !== 1 || opcode !== 0 || tc !== 0) {
          reject(
            new Error(
              [
                "Unexpected flag value in header section",
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }
        const rcode = flags & 0x0f;
        if (rcode !== 0) {
          reject(
            new Error(
              [
                `${rcode} RCODE response`,
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }

        const qdcount = answer.readUInt16BE((offset += 2));
        const ancount = answer.readUInt16BE((offset += 2));
        const nscount = answer.readUInt16BE((offset += 2));
        const arcount = answer.readUInt16BE((offset += 2));
        if (qdcount !== 1 || ancount < 0 || nscount < 0 || arcount < 0) {
          reject(
            new Error(
              [
                "Unexpected entry count in header section",
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }

        const qname = this.#decodeName(answer, (offset += 2));
        const qtype = answer.readUInt16BE((offset += qname.bytesLength));
        const qclass = answer.readUInt16BE((offset += 2));
        if ((qtype !== 1 && qtype !== 28) || qclass !== 1) {
          reject(
            new Error(
              [
                "Unexpected response in question section",
                `Encoded query: ${query.toString("base64")}`,
                `Encoded response: ${answer.toString("base64")}`,
              ].join("\n")
            )
          );
          return;
        }

        offset += 2;
        for (let i = 0; i < ancount; i++) {
          const aname = this.#decodeName(answer, offset);
          const atype = answer.readUInt16BE((offset += aname.bytesLength));
          const aclass = answer.readUInt16BE((offset += 2));
          const ttl = answer.readUInt32BE((offset += 2));
          const rdlength = answer.readUInt16BE((offset += 4));
          const rdata = answer.slice((offset += 2), (offset += rdlength));

          // Skip any record other than A or AAAA.
          if ((atype !== 1 && atype !== 28) || aclass !== 1) {
            continue;
          }

          if (
            (family === 4 && rdlength !== 4) ||
            (family === 6 && rdlength !== 16)
          ) {
            reject(
              new Error(
                [
                  `Unexpected RDLENGTH ${rdlength} for address family ${family}`,
                  `Encoded query: ${query.toString("base64")}`,
                  `Encoded response: ${answer.toString("base64")}`,
                ].join("\n")
              )
            );
            return;
          }

          let addr = "";
          if (family === 4) {
            for (let i = 0; i < 4; i++) {
              if (i !== 0) addr += ".";
              addr += rdata[i].toString(10);
            }
          } else if (family === 6) {
            for (let i = 0; i < 16; i += 2) {
              if (i !== 0) addr += ":";
              addr += ((rdata[i] << 8) | rdata[i + 1]).toString(16);
            }
          }

          resolve({ addr, ttl });
          return;
        }

        reject(
          new Error(
            [
              "No valid answer found",
              `Encoded query: ${query.toString("base64")}`,
              `Encoded response: ${answer.toString("base64")}`,
            ].join("\n")
          )
        );
      });

      socket.on("error", (error) => {
        if (!socket.destroyed) socket.destroy();
        reject(error);
      });
    });
  }

  #encodeName(name) {
    const arr = [];
    for (let label of name.split(".")) {
      if (label.length === 0) continue;
      arr.push(label.length);
      for (let char of label) {
        arr.push(char.charCodeAt(0));
      }
    }
    arr.push(0x00);
    return Buffer.from(arr);
  }

  #decodeName(buf, offset = 0) {
    const labels = [];
    let bytesLength = 0;
    let len = buf.readUInt8(offset);
    if (len === 0) {
      const name = new String(".");
      name.bytesLength = 1;
      return name;
    }
    if (len >= 0xc0) {
      const name = this.#decodeName(buf, buf.readUInt16BE(offset) - 0xc000);
      name.bytesLength = 2;
      return name;
    }
    while (len > 0) {
      if (len >= 0xc0) {
        const label = this.#decodeName(buf, buf.readUInt16BE(offset) - 0xc000);
        labels.push(label);
        const name = new String(labels.join("."));
        name.bytesLength = bytesLength;
        return name;
      }
      labels.push(buf.toString("utf8", ++offset, offset + len));
      bytesLength += len + 1;
      len = buf.readUInt8((offset += len));
    }
    const name = new String(labels.join("."));
    name.bytesLength = bytesLength + 1;
    return name;
  }

  #sha256(data) {
    return crypto.createHash("sha256").update(data).digest("base64");
  }
}

export class DemergiResolverMaster extends DemergiResolver {
  addMessageListener(worker) {
    worker.on("message", async ({ hostname, family }) => {
      try {
        const addr = await this.resolve(hostname, family);
        worker.send(addr);
      } catch (error) {
        console.error(error.message);
        worker.send(null);
      }
    });
  }
}

export class DemergiResolverWorker extends DemergiResolver {
  async resolve(hostname, family) {
    return new Promise((resolve, reject) => {
      process.once("message", (addr) => {
        if (!addr) {
          reject(new Error("Resolver error"));
          return;
        }
        resolve(addr);
      });
      process.send({ hostname, family });
    });
  }
}
