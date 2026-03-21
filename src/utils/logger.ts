const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
} as const;

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info(msg: string, ...args: unknown[]) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.blue}INFO${COLORS.reset}  ${msg}`,
      ...args
    );
  },
  success(msg: string, ...args: unknown[]) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}OK${COLORS.reset}    ${msg}`,
      ...args
    );
  },
  warn(msg: string, ...args: unknown[]) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN${COLORS.reset}  ${msg}`,
      ...args
    );
  },
  error(msg: string, ...args: unknown[]) {
    console.error(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} ${msg}`,
      ...args
    );
  },
  task(taskId: string, state: string, msg: string) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}TASK${COLORS.reset}  ${COLORS.magenta}${taskId}${COLORS.reset} [${state}] ${msg}`
    );
  },
  divider() {
    console.log(`${COLORS.dim}${"─".repeat(60)}${COLORS.reset}`);
  },
};
