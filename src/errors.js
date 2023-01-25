export class ProxyTLSVersionError extends Error {
  constructor(version) {
    super(`Unknown TLS version ${version}`);
  }
}

export class ProxyRequestError extends Error {
  constructor(socket) {
    super(`Received an invalid request from client ${socket.remoteAddress}`);
  }
}

export class ProxyRequestMethodError extends Error {
  constructor(socket) {
    super(`Received an unknown method from client ${socket.remoteAddress}`);
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
      `Received an unknown HTTP version from client ${socket.remoteAddress}`
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

export class ResolverDNSModeError extends Error {
  constructor(mode) {
    super(`Unknown DNS mode ${mode}`);
  }
}

export class ResolverNoAddressError extends Error {
  constructor(hostname) {
    super(`No address found for ${hostname}`);
  }
}

export class ResolverCertificatePINError extends Error {
  constructor(expected, received) {
    super(
      "Certificate validation error, the public key does not match the pinned one" +
        `\nExpected: ${expected}` +
        `\nReceived: ${received}`
    );
  }
}

export class ResolverAnswerError extends Error {
  constructor(message, question, answer) {
    if (question) {
      message += `\nEncoded question: ${question.toString("base64")}`;
    }
    if (answer) {
      message += `\nEncoded answer: ${answer.toString("base64")}`;
    }
    super(message);
  }
}

export class ResolverAnswerTimeoutError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Answer timeout", question, answer);
  }
}

export class ResolverAnswerLengthError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer length", question, answer);
  }
}

export class ResolverAnswerIDError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer ID", question, answer);
  }
}

export class ResolverAnswerFlagError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer flag", question, answer);
  }
}

export class ResolverAnswerCountError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer count", question, answer);
  }
}

export class ResolverAnswerQuestionError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer question", question, answer);
  }
}

export class ResolverAnswerResourceDataLengthError extends ResolverAnswerError {
  constructor(question, answer) {
    super("Unexpected answer resource data length", question, answer);
  }
}
