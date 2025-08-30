import crypto from "node:crypto";
import dns from "node:dns";
import http2 from "node:http2";
import net from "node:net";
import tls from "node:tls";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { isBun } from "./utils.js";
import { LRU } from "./lru.js";
import { Logger } from "./logger.js";
import {
  ResolverAnswerCountError,
  ResolverAnswerDecompressionError,
  ResolverAnswerFlagError,
  ResolverAnswerIDError,
  ResolverAnswerLengthError,
  ResolverAnswerQuestionError,
  ResolverAnswerResourceDataLengthError,
  ResolverAnswerStatusError,
  ResolverAnswerTimeoutError,
  ResolverCertificatePINError,
  ResolverDNSModeError,
  ResolverNoAddressError,
} from "./errors.js";

const {
  HTTP2_HEADER_ACCEPT,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_SCHEME,
  HTTP2_HEADER_STATUS,
  NGHTTP2_REFUSED_STREAM,
} = http2.constants;

export class DemergiResolver {
  #ttlMin = 30;
  #answerTimeout = 5000;
  #dohClient;

  constructor({
    dnsMode = "doh",
    dnsCacheSize = 100000,
    dnsIpOverrides = {},
    dohUrl = "https://1.0.0.1/dns-query",
    dohTlsServername,
    dohTlsPin,
    dohPersistent = true,
    dotServer = "1.0.0.1",
    dotTlsServername,
    dotTlsPin,
  } = {}) {
    this.dnsMode = dnsMode;
    this.dnsCache = new LRU(dnsCacheSize);
    this.dnsIpOverrides = this.#compileIpOverrides(dnsIpOverrides);

    this.dohUrl = new URL(dohUrl);
    if (dohTlsServername) {
      this.dohTlsServername = dohTlsServername;
    } else if (net.isIP(this.dohUrl.hostname) === 0 || isBun) {
      this.dohTlsServername = this.dohUrl.hostname;
    }
    this.dohTlsPin = dohTlsPin;
    this.dohPersistent = dohPersistent;

    this.dotServer = new URL(`tls://${dotServer}`);
    if (dotTlsServername) {
      this.dotTlsServername = dotTlsServername;
    } else if (net.isIP(this.dotServer.hostname) === 0 || isBun) {
      this.dotTlsServername = this.dotServer.hostname;
    }
    this.dotTlsPin = dotTlsPin;
  }

  async resolve(hostname) {
    // Request IPv4 and IPv6 addresses in parallel.
    let addresses = await Promise.all(
      [6, 4].map(async (family) => {
        const cacheKey = `${hostname},${family}`;
        let address = this.dnsCache.get(cacheKey);
        if (address === undefined) {
          Logger.debug(`Resolving ${hostname} (${family})`);
          const answer = await this.#resolve(hostname, family);
          let resolved = answer.address;
          if (resolved !== null) {
            const override = this.#findIpOverride(resolved, family);
            if (override !== null) resolved = override;
          }
          Logger.debug(`Resolved ${hostname} (${family}) to ${resolved}`);
          this.dnsCache.set(cacheKey, resolved, answer.ttl);
          address = resolved;
        }
        return { address, family };
      }),
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
      case "doh":
        return this.#resolveDoh(...args);
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
        if (
          error ||
          addresses.length === 0 ||
          // Skip IPv4-mapped IPv6 addresses
          (family === 6 && addresses[0].address.startsWith("::ffff:"))
        ) {
          resolve({ address: null, ttl: this.#ttlMin });
        } else {
          resolve({ address: addresses[0].address, ttl: addresses[0].ttl });
        }
      });
    });
  }

  #resolveDoh(hostname, family, retry = 0) {
    return new Promise((resolve, reject) => {
      const question = this.#encodeQuestion(hostname, family);

      let dohClient = this.dohPersistent ? this.#dohClient : undefined;

      if (dohClient === undefined || dohClient.destroyed || dohClient.closed) {
        Logger.debug(`Connecting to DoH server ${this.dohUrl.host}`);
        dohClient = http2.connect(this.dohUrl.origin, {
          servername: this.dohTlsServername,
          createConnection: () => {
            let socket;
            try {
              socket = tls.connect({
                host: this.dohUrl.hostname,
                port: this.dohUrl.port
                  ? Number.parseInt(this.dohUrl.port, 10)
                  : 443,
                servername: this.dohTlsServername,
                ALPNProtocols: ["h2"],
                rejectUnauthorized:
                  typeof this.dohTlsServername === "string" ||
                  typeof this.dohTlsPin !== "string",
              });
            } catch (error) {
              dohClient.destroy(error);
              return;
            }

            socket.on("error", (error) => {
              dohClient.destroy(error);
            });

            socket.on("secureConnect", () => {
              if (typeof this.dohTlsPin === "string") {
                const cert = socket.getPeerX509Certificate();
                const pin = this.#pubKeyPin(cert);
                if (this.dohTlsPin !== pin) {
                  dohClient.destroy(
                    new ResolverCertificatePINError(this.dohTlsPin, pin),
                  );
                }
              }
            });

            return socket;
          },
        });

        dohClient.on("error", (error) => {
          reject(error);
        });

        if (this.dohPersistent) {
          this.#dohClient = dohClient;
          this.#dohClient.unref();
        }
      }

      const request = dohClient.request({
        [HTTP2_HEADER_METHOD]: "POST",
        [HTTP2_HEADER_SCHEME]: "https",
        [HTTP2_HEADER_PATH]: this.dohUrl.pathname,
        [HTTP2_HEADER_ACCEPT]: "application/dns-message",
        [HTTP2_HEADER_CONTENT_TYPE]: "application/dns-message",
        [HTTP2_HEADER_CONTENT_LENGTH]: String(question.length),
      });

      request.setTimeout(this.#answerTimeout);

      request.on("timeout", () => {
        request.destroy(new ResolverAnswerTimeoutError(question));
      });

      request.on("error", (error) => {
        if (request.rstCode === NGHTTP2_REFUSED_STREAM && retry < 5) {
          // Retry with exponential backoff if the server refuses the stream.
          resolve(
            new Promise((r) => {
              retry++;
              const d = (2 ** (retry + Math.random()) * 20) | 0;
              Logger.debug(`REFUSED_STREAM received, retrying in ${d}ms`);
              setTimeout(() => r(this.#resolveDoh(hostname, family, retry)), d);
            }),
          );
        } else {
          reject(error.cause ?? error);
        }
      });

      request.on("response", (headers) => {
        const status = headers[HTTP2_HEADER_STATUS];
        if (status !== 200) {
          request.destroy(new ResolverAnswerStatusError(status, question));
        }
      });

      const answer = [];
      request.on("data", (chunk) => answer.push(chunk));
      request.on("end", () => {
        if (!this.dohPersistent) {
          dohClient.close();
        }
        if (answer.length > 0) {
          try {
            resolve(this.#decodeAnswer(question, Buffer.concat(answer)));
          } catch (error) {
            reject(error);
          }
        }
      });

      request.end(question);
    });
  }

  #resolveDot(hostname, family) {
    return new Promise((resolve, reject) => {
      const question = this.#encodeQuestion(hostname, family);

      let socket;
      try {
        socket = tls.connect({
          host: this.dotServer.hostname,
          port: this.dotServer.port || 853,
          servername: this.dotTlsServername,
          ALPNProtocols: ["dot"],
          rejectUnauthorized:
            typeof this.dotTlsServername === "string" ||
            typeof this.dotTlsPin !== "string",
        });
      } catch (error) {
        reject(error);
        return;
      }

      socket.setTimeout(this.#answerTimeout);

      socket.on("timeout", () => {
        socket.destroy(new ResolverAnswerTimeoutError(question));
      });

      socket.on("error", (error) => {
        reject(error);
      });

      socket.on("secureConnect", () => {
        if (typeof this.dotTlsPin === "string") {
          const cert = socket.getPeerX509Certificate();
          const pin = this.#pubKeyPin(cert);
          if (this.dotTlsPin !== pin) {
            socket.destroy(
              new ResolverCertificatePINError(this.dotTlsPin, pin),
            );
            return;
          }
        }

        const length = Buffer.alloc(2);
        length.writeUInt16BE(question.byteLength, 0);

        socket.write(Buffer.concat([length, question]));
      });

      socket.on("data", (answer) => {
        socket.destroy();

        try {
          const length = answer.readUInt16BE(0);
          if (length !== answer.byteLength - 2) {
            throw new ResolverAnswerLengthError(question, answer);
          }

          resolve(this.#decodeAnswer(question, answer.subarray(2)));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  #encodeQuestion(hostname, family) {
    return Buffer.from([
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
  }

  #decodeAnswer(question, answer) {
    let offset = 0;

    const questionId = question.readUInt16BE(0);
    const answerId = answer.readUInt16BE(offset);
    if (answerId !== questionId) {
      throw new ResolverAnswerIDError(question, answer);
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
    const rcode = flags & 0x0f;
    if (qr !== 1 || opcode !== 0 || tc !== 0 || rcode > 15) {
      throw new ResolverAnswerFlagError(question, answer);
    }

    const qdcount = answer.readUInt16BE((offset += 2));
    const ancount = answer.readUInt16BE((offset += 2));
    const nscount = answer.readUInt16BE((offset += 2));
    const arcount = answer.readUInt16BE((offset += 2));
    if (qdcount !== 1) {
      throw new ResolverAnswerCountError(question, answer);
    }

    const [, qnameLen] = this.#decodeName(answer, (offset += 2));
    const qtype = answer.readUInt16BE((offset += qnameLen));
    const qclass = answer.readUInt16BE((offset += 2));
    if ((qtype !== 1 && qtype !== 28) || qclass !== 1) {
      throw new ResolverAnswerQuestionError(question, answer);
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
      if (atype === 1 && atype === qtype) {
        if (rdlength !== 4) {
          throw new ResolverAnswerResourceDataLengthError(question, answer);
        }

        let address = "";
        for (let i = 0; i < 4; i++) {
          if (i !== 0) address += ".";
          address += rdata[i].toString(10);
        }

        return { address, ttl };
      }

      // Handle AAAA type record.
      if (atype === 28 && atype === qtype) {
        if (rdlength !== 16) {
          throw new ResolverAnswerResourceDataLengthError(question, answer);
        }

        let address = "";
        for (let i = 0; i < 16; i += 2) {
          if (i !== 0) address += ":";
          address += ((rdata[i] << 8) | rdata[i + 1]).toString(16);
        }

        return { address, ttl };
      }

      // Handle SOA type record.
      if (atype === 6) {
        return { address: null, ttl };
      }
    }

    return { address: null, ttl: this.#ttlMin };
  }

  #encodeName(name) {
    const arr = [];
    for (const label of name.split(".")) {
      if (label.length === 0) continue;
      arr.push(label.length);
      for (const char of label) {
        arr.push(char.charCodeAt(0));
      }
    }
    arr.push(0x00);
    return Buffer.from(arr);
  }

  #decodeName(buf, offset = 0, depth = 0) {
    if (depth++ > 100) {
      throw new ResolverAnswerDecompressionError(null, null);
    }
    const labels = [];
    let bytesLen = 0;
    let len = buf.readUInt8(offset);
    if (len === 0) {
      const name = ".";
      return [name, 1];
    }
    if (len >= 0xc0) {
      offset = buf.readUInt16BE(offset) - 0xc000;
      const [name] = this.#decodeName(buf, offset, depth);
      return [name, 2];
    }
    while (len > 0) {
      if (len >= 0xc0) {
        offset = buf.readUInt16BE(offset) - 0xc000;
        const [lbl] = this.#decodeName(buf, offset, depth);
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

  #pubKeyPin(cert) {
    // Out-of-Band Key-Pinned Privacy Profile
    // https://www.rfc-editor.org/rfc/rfc7858.html#section-4.2
    const pubKey = cert.publicKey.export({ type: "spki", format: "der" });
    return crypto.createHash("sha256").update(pubKey).digest("base64");
  }

  #compileIpOverrides(map) {
    const overrides = { v4: [], v6: [] };

    if (!map || typeof map !== "object") {
      return overrides;
    }

    for (const [cidr, ip] of Object.entries(map)) {
      if (typeof cidr !== "string" || typeof ip !== "string") {
        Logger.warn(`Ignoring invalid entry: ${cidr} -> ${ip}`);
        continue;
      }

      const ipFamily = net.isIP(ip);
      if (ipFamily !== 4 && ipFamily !== 6) {
        Logger.warn(`Ignoring entry with invalid IP: ${cidr} -> ${ip}`);
        continue;
      }

      const cidrSlashPos = cidr.indexOf("/");
      if (cidrSlashPos <= 0 || cidrSlashPos === cidr.length - 1) {
        Logger.warn(`Ignoring entry with invalid CIDR: ${cidr} -> ${ip}`);
        continue;
      }

      const cidrIp = cidr.slice(0, cidrSlashPos);
      const cidrFamily = net.isIP(cidrIp);
      if (cidrFamily !== ipFamily) {
        Logger.warn(`Ignoring entry with mismatched family: ${cidr} -> ${ip}`);
        continue;
      }

      const cidrPrefix = Number.parseInt(cidr.slice(cidrSlashPos + 1), 10);
      if (!Number.isFinite(cidrPrefix)) {
        Logger.warn(`Ignoring entry with invalid prefix: ${cidr} -> ${ip}`);
        continue;
      }

      const maxPrefix = ipFamily === 6 ? 128 : 32;
      if (cidrPrefix < 0 || cidrPrefix > maxPrefix) {
        Logger.warn(`Ignoring entry with invalid prefix: ${cidr} -> ${ip}`);
        continue;
      }

      try {
        const cidrIpBytes = this.#ipToBytes(cidrIp, cidrFamily);
        const rule = { cidrIpBytes, cidrPrefix, ip };
        if (ipFamily === 6) overrides.v6.push(rule);
        else overrides.v4.push(rule);
      } catch {
        Logger.warn(`Ignoring invalid entry: ${cidr} -> ${ip}`);
        continue;
      }
    }

    // Longest prefix first.
    overrides.v6.sort((a, b) => b.cidrPrefix - a.cidrPrefix);
    overrides.v4.sort((a, b) => b.cidrPrefix - a.cidrPrefix);

    return overrides;
  }

  #ipToBytes(ip, family) {
    const bytes = family === 6 ? new Uint8Array(16) : new Uint8Array(4);
    if (family === 6) {
      let [head, tail] = ip.split("::");
      let hp = head ? head.split(":") : [];
      let tp = tail ? tail.split(":") : [];
      if (ip.includes("::")) {
        const mi = 8 - (hp.filter(Boolean).length + tp.filter(Boolean).length);
        const ze = new Array(mi).fill("0");
        const gr = [...(hp[0] ? hp : []), ...ze, ...(tp[0] ? tp : [])];
        hp = gr;
        tp = [];
      }
      const groups = tp.length ? [...hp, ...tp] : hp;
      if (groups.length !== 8) {
        throw new Error("invalid ipv6");
      }
      for (let i = 0, j = 0; i < 8; i++, j += 2) {
        const n = Number.parseInt(groups[i] || "0", 16);
        if (!Number.isFinite(n) || n < 0 || n > 0xffff) {
          throw new Error("invalid ipv6");
        }
        bytes[j] = (n >> 8) & 0xff;
        bytes[j + 1] = n & 0xff;
      }
    } else {
      const p = ip.split(".");
      if (p.length !== 4) {
        throw new Error("invalid ipv4");
      }
      for (let i = 0; i < 4; i++) {
        const n = Number.parseInt(p[i], 10);
        if (!Number.isFinite(n) || n < 0 || n > 255) {
          throw new Error("invalid ipv4");
        }
        bytes[i] = n;
      }
    }
    return bytes;
  }

  #ipMatchesCidr(ipBytes, cidrIpBytes, cidrPrefix) {
    const full = Math.floor(cidrPrefix / 8);
    const rest = cidrPrefix % 8;
    for (let i = 0; i < full; i++) {
      if (ipBytes[i] !== cidrIpBytes[i]) return false;
    }
    if (rest === 0) return true;
    const mask = 0xff << (8 - rest);
    return (ipBytes[full] & mask) === (cidrIpBytes[full] & mask);
  }

  #findIpOverride(ip, family) {
    const rules = this.dnsIpOverrides[family === 6 ? "v6" : "v4"];
    if (rules.length === 0) return null;
    try {
      const ipBytes = this.#ipToBytes(ip, family);
      for (const rule of rules) {
        if (this.#ipMatchesCidr(ipBytes, rule.cidrIpBytes, rule.cidrPrefix)) {
          return rule.ip;
        }
      }
    } catch {
      // If parsing the resolved IP fails (shouldn't happen), do not override.
      Logger.warn(`Failed to parse resolved IP address: ${ip}`);
    }
    return null;
  }
}
