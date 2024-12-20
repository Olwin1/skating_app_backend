export enum ErrorCode {
  InvalidEmail = 0x001,
  InvalidPassword = 0x002,
  InvalidUsername = 0x003,
  IncorrectPassword = 0x004,
  RecordNotFound = 0x005,
}

export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.InvalidEmail]: "String is not in email format",
  [ErrorCode.InvalidPassword]: "Password does not fit required length",
  [ErrorCode.InvalidUsername]: "Username does not fit required length",
  [ErrorCode.IncorrectPassword]: "Password does not match that stored",
  [ErrorCode.RecordNotFound]:
    "A record could not be found for the specified parameters",
};
