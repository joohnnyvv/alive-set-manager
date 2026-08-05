export function timestamp(): string {
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hrs}:${mins}:${secs}.${ms}]`;
}

export function logInfo(tag: string, message: string, ...args: any[]): void {
  console.log(`${timestamp()} [${tag}] ${message}`, ...args);
}

export function logWarn(tag: string, message: string, ...args: any[]): void {
  console.warn(`${timestamp()} [${tag}] ${message}`, ...args);
}

export function logError(tag: string, message: string, ...args: any[]): void {
  console.error(`${timestamp()} [${tag}] ${message}`, ...args);
}
