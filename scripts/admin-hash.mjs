// Usage: npm run admin:hash -- 'your password'   (or run without an argument to be prompted)
// Prints the value to put in ADMIN_PASSWORD_HASH. The password itself is never stored.
import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';

async function ask() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((r) => rl.question('Password: ', (a) => { rl.close(); r(a); }));
}

const password = process.argv[2] ?? (await ask());
if (password.length < 10) {
  console.error('Use at least 10 characters.');
  process.exit(1);
}
const salt = randomBytes(16);
scrypt(password, salt, 64, { N: 16384, maxmem: 64 * 1024 * 1024 }, (err, key) => {
  if (err) throw err;
  console.log(`scrypt:16384:${salt.toString('hex')}:${key.toString('hex')}`);
});
