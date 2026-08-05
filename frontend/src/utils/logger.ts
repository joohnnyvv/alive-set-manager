export function timestamp(): string {
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hrs}:${mins}:${secs}.${ms}]`;
}

export function logUi(message: string, ...args: any[]): void {
  console.log(`${timestamp()} 📱 [UI] ${message}`, ...args);
}

export function logWsTx(message: string, ...args: any[]): void {
  console.log(`${timestamp()} ⬆️ [WS TX] ${message}`, ...args);
}

export function logWsRx(message: string, ...args: any[]): void {
  console.log(`${timestamp()} ⬇️ [WS RX] ${message}`, ...args);
}

export function logState(message: string, ...args: any[]): void {
  console.log(`${timestamp()} 🔄 [STATE] ${message}`, ...args);
}
