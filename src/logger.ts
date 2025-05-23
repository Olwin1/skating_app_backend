namespace Logger {
  export const colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",

    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",

    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m",
  };

  export const log = {
    magenta: (label: string, str: string): void =>
      console.log(
        colors.BgMagenta + colors.FgWhite + label + ":" + colors.Reset,
        colors.FgMagenta + str,
        colors.Reset
      ),
    red: (label: string, str: string): void =>
      console.log(
        colors.BgRed + colors.FgWhite + label + ":" + colors.Reset,
        colors.FgRed + str,
        colors.Reset
      ),
    cyan: (label: string, str: string): void =>
      console.log(
        colors.BgCyan + colors.FgBlack + label + ":" + colors.Reset,
        colors.FgCyan + str,
        colors.Reset
      ),
    yellow: (label: string, str: string): void =>
      console.log(
        colors.BgYellow + colors.FgBlack + label + ":" + colors.Reset,
        colors.FgYellow + str,
        colors.Reset
      ),
    green: (label: string, str: string): void =>
      console.log(
        colors.BgGreen + colors.FgBlack + label + ":" + colors.Reset,
        colors.FgGreen + str,
        colors.Reset
      ),
    white: (label: string, str: string): void =>
      console.log(
        colors.BgWhite + colors.FgBlack + label + ":" + colors.Reset,
        colors.FgWhite + str,
        colors.Reset
      ),
  };
}
export = Logger;
