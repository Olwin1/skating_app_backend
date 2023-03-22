declare module 'mercedlogger' {
    const colors: {// Define types for colour object
        Reset: string;
        Bright: string;
        Dim: string;
        Underscore: string;
        Blink: string;
        Reverse: string;
        Hidden: string;
        FgBlack: string;
        FgRed: string;
        FgGreen: string;
        FgYellow: string;
        FgBlue: string;
        FgMagenta: string;
        FgCyan: string;
        FgWhite: string;
        BgBlack: string;
        BgRed: string;
        BgGreen: string;
        BgYellow: string;
        BgBlue: string;
        BgMagenta: string;
        BgCyan: string;
        BgWhite: string;
      };
      
      const log: {// Define types for log
        magenta: (label: string, str: string) => void;
        red: (label: string, str: string) => void;
        cyan: (label: string, str: string) => void;
        yellow: (label: string, str: string) => void;
        green: (label: string, str: string) => void;
        white: (label: string, str: string) => void;
      };
      
}