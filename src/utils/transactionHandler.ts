import { Prisma, PrismaClient } from "@prisma/client";
import { ITXClientDenyList } from "@prisma/client/runtime/library";
import * as runtime from "@prisma/client/runtime/library";
import $Utils = runtime.Types.Utils;
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import ServerError from "../Exceptions/Server/ServerError";
import Logger from "./logging";

import { Types } from "@prisma/client/runtime/library";
/**
 * [TransactionHandler] class is responsible for handling generic Prisma transactions throughout the application.
 * Will handle & throw any relevant errors and is designed to be used within routes.
 */
class TransactionHandler {
  /**
   *
   * @param {PrismaClient} prisma - The current prisma instance the transaction will be created in.
   * @param {[...P] | ((prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>)} queries - The prisma queries to include within the transaction or a function to execute within the transaction.
   * @param {number} maxRetries - The maximum number of retries when a transaction fails due to conflicts.  (Defaults to 5)
   * @returns {Promise<void>} If functions correctly will return an array of each individual query results.
   * @throws {ServerError} - If the transaction does not successfully complete.
   */
  private static async createTransaction<
    P extends Prisma.PrismaPromise<any>[],
    R
  >(
    prisma: PrismaClient,
    queries:
      | [...P]
      | ((
          prisma: Omit<PrismaClient, runtime.ITXClientDenyList>
        ) => $Utils.JsPromise<R>),
    maxRetries: number
  ): $Utils.JsPromise<R | runtime.Types.Utils.UnwrapTuple<P>> {
    // To keep track of the number of transaction attempts
    let retries = 0;

    // Declare result variables
    let result: R | runtime.Types.Utils.UnwrapTuple<P>;
    let lastError: PrismaClientKnownRequestError;

    // Retry until either the transaction completes successfully or the `maxRetries` is reached.
    while (retries < maxRetries) {
      // Try-catch block to handle any errors that may arise correctly.
      try {
        // Attempt transaction passing in the user specified arguments.
        // Set the `isolationLevel` to `Serializable` to reduce conflicts.
        if (typeof queries === "function") {
          // Functional transaction style
          result = await prisma.$transaction(queries, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        } else {
          // Batched transaction style
          result = await prisma.$transaction(queries, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        }
        // Cease execution of the method and return to caller.
        return result;
      } catch (error) {
        // If the error raised has an error code
        if (error instanceof PrismaClientKnownRequestError) {
          // If the error is due to a conflict during transaction.
          if (error.code === "P2034") {
            // Send the error to the logger & if will retry then say retrying.
            Logger.instance.logger.warn(
              `A transaction failed due to a write conflict or a deadlock. ${
                retries < maxRetries - 1 ? "Retrying transaction..." : ""
              }`
            );
            // Increment retries counter by 1
            retries++;
            // Store the error in the last error so it can be accessed if the loop ends.
            lastError = error;
            // Skip to the next iteration of the loop.
            continue;
          } else {
            // If it is a different kind of `PrismaClientKnownRequestError` then throw a `ServerError`
            throw new ServerError(
              `A error of code: [${error.code}] has occurred during Prisma transaction: ${error.message}`
            );
          }

          // If the error raised does not have a known error code. Throw a `ServerError`
        } else if (error instanceof PrismaClientUnknownRequestError) {
          throw new ServerError(
            `An unknown error has occurred during Prisma transaction: ${error.message}`
          );

          // If the error raised is an issue relating to a query's syntax throw a `ServerError`
        } else if (error instanceof PrismaClientValidationError) {
          throw new ServerError(
            `A error has occurred during Prisma transaction: ${error.message}`
          );

          // If the error is not known throw a `ServerError`
        } else {
          throw new ServerError(
            `An unhandled error occured during Prisma transaction: ${error}`
          );
        }
      }
    }

    // If reaches here then all retries must have failed and no other errors were thrown.
    throw new ServerError(
      `(P2034) A Prisma transaction failed due to a write conflict or a deadlock: ${
        lastError!.message
      }`
    );
  }

  public static async createTransactionArray<
    P extends Prisma.PrismaPromise<any>[],
  >(
    prisma: PrismaClient,
    queries:
      | [...P],
    maxRetries: number = 5
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>> {
    return await this.createTransaction(prisma, queries, maxRetries);
  }

  public static async createTransactionFunction<R>(
    prisma: PrismaClient,
    queries: ((
      prisma: Omit<PrismaClient, runtime.ITXClientDenyList>
    ) => $Utils.JsPromise<R>),
    maxRetries: number = 5
  ): $Utils.JsPromise<R> {
    return await this.createTransaction(prisma, queries, maxRetries) as Awaited<R>;

  }
}
export default TransactionHandler;
