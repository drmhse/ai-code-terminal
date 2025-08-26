// Mock Prisma Client
const prisma = {
  workspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  settings: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn()
  },
  session: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn()
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $on: jest.fn()
};

module.exports = {
  PrismaClient: jest.fn(() => prisma),
  prisma
};