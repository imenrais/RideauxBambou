import { prisma } from "./prisma";

async function connectDB() {
  await prisma.$connect();
  return prisma;
}

export default connectDB;
