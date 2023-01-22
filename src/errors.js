export class ProxyTLSVersionError extends Error {
  constructor(version) {
    super(`Unsupported TLS version ${version}`);
  }
}

export class ProxyRequestMalformedError extends Error {
  constructor(socket) {
    super(`Received a malformed request from client ${socket.remoteAddress}`);
  }
}

export class ProxyRequestMethodError extends Error {
  constructor(socket) {
    super(`Received an unsupported method from client ${socket.remoteAddress}`);
  }
}

export class ProxyRequestTargetError extends Error {
  constructor(socket) {
    super(`Received an invalid target from client ${socket.remoteAddress}`);
  }
}

export class ProxyRequestHTTPVersionError extends Error {
  constructor(socket) {
    super(
      `Received an unsupported HTTP version from client ${socket.remoteAddress}`
    );
  }
}

export class ProxyUpstreamConnectError extends Error {
  constructor(socket, error) {
    super(
      `Exception occurred while connecting to upstream ${socket.remoteAddress}: ${error.message}`
    );
  }
}

export class ProxyUpstreamWriteError extends Error {
  constructor(socket, error) {
    super(
      `Exception occurred while sending data to upstream ${socket.remoteAddress}: ${error.message}`
    );
  }
}

export class ProxyClientWriteError extends Error {
  constructor(socket, error) {
    super(
      `Exception occurred while sending data to client ${socket.remoteAddress}: ${error.message}`
    );
  }
}

export class ResolverNoAddressError extends Error {
  constructor(hostname) {
    super(`No address found for ${hostname}`);
  }
}

export class ResolverDNSModeError extends Error {
  constructor(mode) {
    super(`Unknown DNS mode ${mode}`);
  }
}

export class ResolverDOTCertificatePINError extends Error {
  constructor(expected, received) {
    super(
      "Certificate validation error, the public key does not match the pinned one" +
        `\nExpected: ${expected}` +
        `\nReceived: ${received}`
    );
  }
}

export class ResolverDOTResponseError extends Error {
  constructor(message, query, response) {
    if (query) {
      message += `\nEncoded query: ${query.toString("base64")}`;
    }
    if (response) {
      message += `\nEncoded response: ${response.toString("base64")}`;
    }
    super(message);
  }
}

export class ResolverDOTResponseLengthError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Unexpected response length", query, response);
  }
}

export class ResolverDOTResponseIDError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Received a different response ID", query, response);
  }
}

export class ResolverDOTResponseFlagValueError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Unexpected flag value in header section", query, response);
  }
}

export class ResolverDOTResponseRCODEError extends ResolverDOTResponseError {
  constructor(rcode, query, response) {
    super(`Unexpected ${rcode} RCODE`, query, response);
  }
}

export class ResolverDOTResponseEntryCountError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Unexpected entry count in header section", query, response);
  }
}

export class ResolverDOTResponseQuestionError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Unexpected response in question section", query, response);
  }
}

export class ResolverDOTResponseRDLENGTHError extends ResolverDOTResponseError {
  constructor(rdlength, query, response) {
    super(`Unexpected RDLENGTH ${rdlength}`, query, response);
  }
}

export class ResolverDOTResponseAnswerError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("No valid answer found", query, response);
  }
}

export class ResolverDOTNoResponseError extends ResolverDOTResponseError {
  constructor(query, response) {
    super("Connection closed without response", query, response);
  }
}
