import winston from "winston";
require("dotenv").config();

// Load the logging level from environment variables
// This will determine how much info will be logged
const { LOGGING_LEVEL = "error" } = process.env;

/**
 * [Logger] is a singleton class used for accessing the logging framework.
 */
class Logger {
  // Define instance variables

  // Holds the global instance
  static _instance: Logger;

  // Stores the logger instance
  private _logger: winston.Logger;

  // Constructor simply sets logger to a new winston.Logger instance.
  constructor() {
    this._logger = Logger.main();
  }

  /**
   *  Accessor method that gets the [winston.Logger] instance.
   */
  public get logger(): winston.Logger {
    return this._logger;
  }

  /**
   * Accessor method that gets the [Logger] instance.
   * If there is no existing instance then create it.
   */
  public static get instance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }

    return Logger._instance;
  }

  // Method used to instantiate the winston framework.
  private static main() {
    const logger = winston.createLogger({
      level: LOGGING_LEVEL,
      format: winston.format.json(),
      defaultMeta: { service: "user-service" },
      transports: [
        //
        // - Write all logs with importance level of `error` or higher to `error.log`
        //   (i.e., error, fatal, but not other levels)
        //
        new winston.transports.File({ filename: "error.log", level: "error" }),
        //
        // - Write all logs with importance level of `info` or higher to `combined.log`
        //   (i.e., fatal, error, warn, and info, but not trace)
        //
        new winston.transports.File({ filename: "combined.log" }),
      ],
    });

    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    //
    if (process.env.NODE_ENV !== "production") {
      logger.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        })
      );
    } else {
      logger.add(
        new winston.transports.Console({
          format: winston.format.prettyPrint(),
        })
      );
    }

    return logger;
  }
}
export default Logger;
