class InternalLogger {
  levels = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
  };

  #level;

  constructor(level = this.levels.INFO) {
    this.level = level;
  }

  get level() {
    return this.#level;
  }

  set level(level) {
    if (typeof level === "number") {
      this.#level = level;
    } else {
      this.#level = this.levels[level?.toUpperCase()] ?? this.levels.NONE;
    }
  }

  get #prefix() {
    return `[${new Date().toISOString()}] [${process.pid}]`;
  }

  error = (...msg) => {
    if (this.level >= this.levels.ERROR) {
      console.error(this.#prefix, "[ERROR]", ...msg);
    }
  };

  warn = (...msg) => {
    if (this.level >= this.levels.WARN) {
      console.warn(this.#prefix, "[WARN]", ...msg);
    }
  };

  info = (...msg) => {
    if (this.level >= this.levels.INFO) {
      console.info(this.#prefix, "[INFO]", ...msg);
    }
  };

  debug = (...msg) => {
    if (this.level >= this.levels.DEBUG) {
      console.debug(this.#prefix, "[DEBUG]", ...msg);
    }
  };
}

export const Logger = new InternalLogger();
