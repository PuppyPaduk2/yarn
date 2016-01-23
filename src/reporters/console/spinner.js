/* @flow */

let readline = require("readline");

function clearLine() {
  // $FlowFixMe: add flow definition for readline.clearLine
  readline.clearLine(process.stdout, 0);
  // $FlowFixMe: add flow definition for readline.cursorTo
  readline.cursorTo(process.stdout, 0);
}

export default class Spinner {
  constructor(){
    this.delay = 60;
    this.chars = Spinner.spinners[28].split("");
    this.text  = "";
    this.id    = null;
  }

  delay: number;
  chars: Array<string>;
  text: string;
  id: ?number;

  // $FlowFixMe: Suppress flow static props error
  static spinners: Array<string> = [
    "|/-\\",
    "⠂-–—–-",
    "◐◓◑◒",
    "◴◷◶◵",
    "◰◳◲◱",
    "▖▘▝▗",
    "■□▪▫",
    "▌▀▐▄",
    "▉▊▋▌▍▎▏▎▍▌▋▊▉",
    "▁▃▄▅▆▇█▇▆▅▄▃",
    "←↖↑↗→↘↓↙",
    "┤┘┴└├┌┬┐",
    "◢◣◤◥",
    ".oO°Oo.",
    ".oO@*",
    "🌍🌎🌏",
    "◡◡ ⊙⊙ ◠◠",
    "☱☲☴",
    "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏",
    "⠋⠙⠚⠞⠖⠦⠴⠲⠳⠓",
    "⠄⠆⠇⠋⠙⠸⠰⠠⠰⠸⠙⠋⠇⠆",
    "⠋⠙⠚⠒⠂⠂⠒⠲⠴⠦⠖⠒⠐⠐⠒⠓⠋",
    "⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠴⠲⠒⠂⠂⠒⠚⠙⠉⠁",
    "⠈⠉⠋⠓⠒⠐⠐⠒⠖⠦⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈",
    "⠁⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈⠈",
    "⢄⢂⢁⡁⡈⡐⡠",
    "⢹⢺⢼⣸⣇⡧⡗⡏",
    "⣾⣽⣻⢿⡿⣟⣯⣷",
    "⠁⠂⠄⡀⢀⠠⠐⠈"
  ];

  setText(text: string) {
    this.text = text;
  }

  start() {
    let current = 0;

    this.id = setInterval(() => {
      let msg = `${this.chars[current]} ${this.text}`;
      clearLine();
      process.stdout.write(msg);
      current = ++current % this.chars.length;
    }, this.delay);
  }

  stop() {
    if (this.id == null) {
      throw new Error("Can't stop a spinner that wasn't running");
    }

    clearInterval(this.id);
    clearLine();
    this.id = null;
  }
}
