import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/config/prisma.js";

const SALT_ROUNDS = 12;

function parseArgs() {
  const args = process.argv.slice(2);
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i].startsWith("--email=")) {
      email = args[i].split("=")[1];
    } else if (args[i] === "--password" && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i].startsWith("--password=")) {
      password = args[i].split("=")[1];
    }
  }

  return { email: email?.trim(), password };
}

async function createAdmin() {
  const { email, password } = parseArgs();

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.js --email <email> --password <password>");
    console.error("   or: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> node scripts/create-admin.js");
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email format.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error(`Refused: User with email "${email}" already exists (Role: ${existingUser.role}).`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newAdmin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(`Successfully created production ADMIN account:`);
    console.log(`- ID: ${newAdmin.id}`);
    console.log(`- Email: ${newAdmin.email}`);
    console.log(`- Role: ${newAdmin.role}`);
    console.log(`- Status: ${newAdmin.status}`);
  } catch (err) {
    console.error("Error creating admin account:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
