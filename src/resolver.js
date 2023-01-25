import crypto from "node:crypto";
import dns from "node:dns";
import tls from "node:tls";
import { LRU } from "./lru.js";
import {
  ResolverNoAddressError,
  ResolverDNSModeError,
  ResolverDOTCertificatePINError,
  ResolverDOTResponseLengthError,
  ResolverDOTResponseIDError,
  ResolverDOTResponseFlagValueError,
  ResolverDOTResponseRCODEError,
  ResolverDOTResponseEntryCountError,
  ResolverDOTResponseQuestionError,
  ResolverDOTResponseRDLENGTHError,
  ResolverDOTNoResponseError,
} from "./errors.js";

export class DemergiResolver {
  #ttlMin = 30;
  #queryTimeout = 5000;

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

  async resolve(hostname) {
    // Request IPv4 and IPv6 addresses in parallel.
    let addresses = await Promise.all(
      [6, 4].map(async (family) => {
        const cacheKey = `${hostname},${family}`;
        let address = this.dnsCache.get(cacheKey);
        if (address === undefined) {
          const response = await this.#resolve(hostname, family);
          this.dnsCache.set(cacheKey, response.address, response.ttl);
          address = response.address;
        }
        return { address, family };
      })
    );

    // There may be cached requests to non-existent domains, in which case the address is null.
    addresses = addresses.filter(({ address }) => address !== null);

    if (addresses.length === 0) {
      throw new ResolverNoAddressError(hostname);
    }

    return addresses;
  }

  #resolve(...args) {
    switch (this.dnsMode) {
      case "plain":
        return this.#resolvePlain(...args);
      case "dot":
        return this.#resolveDot(...args);
      default:
        throw new ResolverDNSModeError(this.dnsMode);
    }
  }

  #resolvePlain(hostname, family) {
    return new Promise((resolve) => {
      const resolveDns = family === 6 ? dns.resolve6 : dns.resolve4;
      resolveDns(hostname, { ttl: true }, (error, addresses) => {
        if (error || addresses.length === 0) {
          resolve({ address: null, ttl: this.#ttlMin });
        } else {
          resolve({ address: addresses[0].address, ttl: addresses[0].ttl });
        }
      });
    });
  }

  #resolveDot(hostname, family) {
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
        // QR    | OPCODE   | AA       | TC       | RD
        (0 << 7) | (0 << 3) | (0 << 2) | (0 << 1) | 1,
        // RA    | Z        | AD       | CD       | RCODE
        (0 << 7) | (0 << 6) | (0 << 5) | (0 << 4) | 0,
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
        0x00,
        family === 6 ? 0x1c : 0x01,
        // QCLASS
        0x00,
        0x01,
      ]);
      query.writeUInt16BE(query.byteLength - 2, 0);

      socket.setTimeout(this.#queryTimeout);

      socket.once("timeout", () => {
        socket.destroy(new ResolverDOTNoResponseError(query));
      });

      socket.once("secureConnect", () => {
        if (typeof this.dotTlsPin === "string") {
          const pubkey256 = this.#sha256(socket.getPeerCertificate().pubkey);
          if (this.dotTlsPin !== pubkey256) {
            socket.destroy(
              new ResolverDOTCertificatePINError(this.dotTlsPin, pubkey256)
            );
            return;
          }
        }

        socket.write(query);
      });

      socket.once("error", (error) => {
        reject(error);
      });

      socket.once("data", (answer) => {
        socket.destroy();

        const length = answer.readUInt16BE(0);
        if (length !== answer.byteLength - 2) {
          reject(new ResolverDOTResponseLengthError(query, answer));
          return;
        }
        // Strip length from answer.
        answer = answer.subarray(2);

        let offset = 0;

        const queryId = query.readUInt16BE(2);
        const answerId = answer.readUInt16BE(offset);
        if (answerId !== queryId) {
          reject(new ResolverDOTResponseIDError(query, answer));
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
          reject(new ResolverDOTResponseFlagValueError(query, answer));
          return;
        }
        const rcode = flags & 0x0f;
        if (rcode > 15) {
          reject(new ResolverDOTResponseRCODEError(rcode, query, answer));
          return;
        }

        const qdcount = answer.readUInt16BE((offset += 2));
        const ancount = answer.readUInt16BE((offset += 2));
        const nscount = answer.readUInt16BE((offset += 2));
        const arcount = answer.readUInt16BE((offset += 2));
        if (qdcount !== 1) {
          reject(new ResolverDOTResponseEntryCountError(query, answer));
          return;
        }

        const [, qnameLen] = this.#decodeName(answer, (offset += 2));
        const qtype = answer.readUInt16BE((offset += qnameLen));
        const qclass = answer.readUInt16BE((offset += 2));
        if ((qtype !== 1 && qtype !== 28) || qclass !== 1) {
          reject(new ResolverDOTResponseQuestionError(query, answer));
          return;
        }

        offset += 2;
        for (let i = 0; i < ancount + nscount + arcount; i++) {
          const [, anameLen] = this.#decodeName(answer, offset);
          const atype = answer.readUInt16BE((offset += anameLen));
          const aclass = answer.readUInt16BE((offset += 2));
          const ttl = answer.readUInt32BE((offset += 2));
          const rdlength = answer.readUInt16BE((offset += 4));
          const rdata = answer.slice((offset += 2), (offset += rdlength));

          // Skip any non IN class record.
          if (aclass !== 1) continue;

          // Handle A type record.
          if (atype === 1 && family === 4) {
            if (rdlength !== 4) {
              reject(
                new ResolverDOTResponseRDLENGTHError(rdlength, query, answer)
              );
              return;
            }

            let address = "";
            for (let i = 0; i < 4; i++) {
              if (i !== 0) address += ".";
              address += rdata[i].toString(10);
            }

            resolve({ address, ttl });
            return;
          }

          // Handle AAAA type record.
          if (atype === 28 && family === 6) {
            if (rdlength !== 16) {
              reject(
                new ResolverDOTResponseRDLENGTHError(rdlength, query, answer)
              );
              return;
            }

            let address = "";
            for (let i = 0; i < 16; i += 2) {
              if (i !== 0) address += ":";
              address += ((rdata[i] << 8) | rdata[i + 1]).toString(16);
            }

            resolve({ address, ttl });
            return;
          }

          // Handle SOA type record.
          if (atype === 6) {
            resolve({ address: null, ttl });
            return;
          }
        }

        resolve({ address: null, ttl: this.#ttlMin });
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
    let bytesLen = 0;
    let len = buf.readUInt8(offset);
    if (len === 0) {
      const name = ".";
      return [name, 1];
    }
    if (len >= 0xc0) {
      const [name] = this.#decodeName(buf, buf.readUInt16BE(offset) - 0xc000);
      return [name, 2];
    }
    while (len > 0) {
      if (len >= 0xc0) {
        const [lbl] = this.#decodeName(buf, buf.readUInt16BE(offset) - 0xc000);
        labels.push(lbl);
        const name = labels.join(".");
        bytesLen += 2;
        return [name, bytesLen];
      }
      labels.push(buf.toString("utf8", ++offset, offset + len));
      bytesLen += len + 1;
      len = buf.readUInt8((offset += len));
    }
    const name = labels.join(".");
    bytesLen += 1;
    return [name, bytesLen];
  }

  #sha256(data) {
    return crypto.createHash("sha256").update(data).digest("base64");
  }
}
