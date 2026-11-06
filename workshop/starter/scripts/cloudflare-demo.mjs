const base = process.env.WORKSHOP_URL;
if (!base) {
  console.error('Set WORKSHOP_URL to the deployed Worker URL, then run npm run demo:full:cf.');
  process.exit(1);
}

const response = await fetch(`${base.replace(/\/$/, '')}/demo/full`, { method: 'POST' });
const body = await response.text();
console.log(body);
if (!response.ok) process.exitCode = 1;
