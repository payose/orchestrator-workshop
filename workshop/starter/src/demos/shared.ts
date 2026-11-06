export function heading(title: string): void {
  console.log(`\n=== ${title} ===`);
}

export function line(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

export function statusFor(value: string): string {
  return value.toUpperCase();
}
