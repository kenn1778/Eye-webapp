import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function readPassword() {
  if (process.argv[2]) return process.argv[2];
  // Require either an explicit argument or a real terminal; otherwise we would
  // block forever waiting on piped stdin that will never provide input.
  if (!input.isTTY) {
    throw new Error("Provide the password as an argument when not running interactively.");
  }
  const rl = createInterface({ input, output });
  const password = await rl.question("New admin password: ");
  rl.close();
  return password;
}

const password = await readPassword();

if (password.length < 12) {
  console.error("Choose a password of at least 12 characters.");
  process.exit(1);
}

// Cost factor 12: slow enough to make offline cracking expensive, fast enough
// that a single login stays responsive.
const hash = await bcrypt.hash(password, 12);
console.log("\nAdd this line to backend/.env:\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
