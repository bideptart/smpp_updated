import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ─── Users ────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      fullName: "Administrator",
      firstName: "System",
      lastName: "Admin",
      passwordHash: adminHash,
      email: "admin@smslocal.in",
      emailVerified: true,
      role: "admin",
      isActive: true,
    },
  });
  console.log("  Created admin user (admin / Admin@123)");

  // Initial super admin (so the system always has one)
  const superHash = await bcrypt.hash("SuperAdmin@2026", 10);
  await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      fullName: "Super Administrator",
      firstName: "Super",
      lastName: "Admin",
      passwordHash: superHash,
      email: "superadmin@smslocal.in",
      emailVerified: true,
      role: "super_admin",
      isActive: true,
    },
  });
  console.log("  Created super admin (superadmin / SuperAdmin@2026)");

  // ─── Companies ────────────────────────────────────────
  const companies = [
    { name: "Demo Customer", code: "DEMOCUST", type: "customer" as const, contactEmail: "demo@smslocal.in" },
    { name: "Demo Vendor", code: "DEMOVEND", type: "vendor" as const, contactEmail: "vendor@demo.com" },
    { name: "MsgClub India", code: "MSGCLUB", type: "customer" as const, contactEmail: "ops@msgclub.net", contactPhone: "+91-9876543210" },
    { name: "BulkSMS Pro", code: "BULKPRO", type: "customer" as const, contactEmail: "tech@bulksmspro.in", contactPhone: "+91-8765432100" },
    { name: "FastAlert Systems", code: "FASTALRT", type: "customer" as const, contactEmail: "connect@fastalert.co.in" },
    { name: "OTP Gateway Ltd", code: "OTPGW", type: "customer" as const, contactEmail: "support@otpgateway.in" },
    { name: "PrimeText Solutions", code: "PRIMETXT", type: "customer" as const, contactEmail: "admin@primetext.co" },
    { name: "Tata Communications", code: "TATACOMM", type: "vendor" as const, contactEmail: "smpp@tatacomm.com" },
    { name: "Vodafone Idea DLT", code: "VIDLT", type: "vendor" as const, contactEmail: "enterprise@vi.co.in" },
    { name: "Airtel Enterprise", code: "AIRTELENT", type: "vendor" as const, contactEmail: "smpp@airtel.in" },
    { name: "Route Mobile", code: "ROUTEMOB", type: "vendor" as const, contactEmail: "noc@routemobile.com" },
    { name: "Valuefirst Digital", code: "VALFIRST", type: "vendor" as const, contactEmail: "tech@valuefirst.com" },
    { name: "almukit", code: "ALMUKIT", type: "vendor" as const, contactEmail: "mcmameyk@gmail.com", contactName: "amey" },
  ];

  for (const c of companies) {
    await prisma.company.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, createdBy: 1 },
    });
  }
  console.log(`  Created ${companies.length} companies`);

  // ─── Connections ──────────────────────────────────────
  const demoVendor = await prisma.company.findUnique({ where: { code: "DEMOVEND" } });
  const tata = await prisma.company.findUnique({ where: { code: "TATACOMM" } });
  const airtel = await prisma.company.findUnique({ where: { code: "AIRTELENT" } });
  const routeMob = await prisma.company.findUnique({ where: { code: "ROUTEMOB" } });
  const almukit = await prisma.company.findUnique({ where: { code: "ALMUKIT" } });

  if (demoVendor) {
    await prisma.connection.upsert({
      where: { id: 1 },
      update: {},
      create: { companyId: demoVendor.id, name: "Demo HTTP Connection", type: "HTTP", direction: "MT", apiUrl: "https://demo-vendor.example.com/api/send", apiKey: "demo-api-key-12345", maxTps: 10, status: "active" },
    });
  }

  if (tata) {
    await prisma.connection.upsert({
      where: { id: 10 },
      update: {},
      create: { id: 10, companyId: tata.id, name: "Tata SMPP Primary", type: "SMPP", direction: "MT", host: "smpp1.tatacomm.com", port: 2775, username: "smslocal_tata1", password: "T@ta$mpp01", maxTps: 500, status: "active" },
    });
  }

  if (airtel) {
    await prisma.connection.upsert({
      where: { id: 14 },
      update: {},
      create: { id: 14, companyId: airtel.id, name: "Airtel SMPP Channel-1", type: "SMPP", direction: "MT", host: "smpp.airtelent.in", port: 2775, username: "smslocal_air1", password: "A!rtel$01", maxTps: 400, status: "active" },
    });
  }

  if (routeMob) {
    await prisma.connection.upsert({
      where: { id: 16 },
      update: {},
      create: { id: 16, companyId: routeMob.id, name: "Route Mobile SMPP", type: "SMPP", direction: "BOTH", host: "smpp.routemobile.com", port: 2775, username: "smslocal_rm", password: "Rm@2024Smpp", maxTps: 1000, status: "active" },
    });
  }

  if (almukit) {
    await prisma.connection.upsert({
      where: { id: 20 },
      update: {},
      create: { id: 20, companyId: almukit.id, name: "almukit", type: "SMPP", direction: "BOTH", host: "65.109.144.158", port: 7777, username: "NEW_DIR1", password: "C6xikzAv", maxTps: 10, status: "inactive" },
    });
  }
  console.log("  Created vendor connections");

  // ─── Routes ───────────────────────────────────────────
  const demoCust = await prisma.company.findUnique({ where: { code: "DEMOCUST" } });
  const bulkpro = await prisma.company.findUnique({ where: { code: "BULKPRO" } });

  if (demoCust && demoVendor) {
    await prisma.route.upsert({
      where: { id: 1 },
      update: {},
      create: { name: "India Route", customerId: demoCust.id, vendorId: demoVendor.id, countryCode: "91", sellingRate: 0.0200, buyingRate: 0.0100, priority: 1 },
    });
  }
  if (bulkpro && routeMob) {
    await prisma.route.upsert({
      where: { id: 4 },
      update: {},
      create: { id: 4, name: "BulkPro→RouteMob India", customerId: bulkpro.id, vendorId: routeMob.id, countryCode: "91", sellingRate: 0.0220, buyingRate: 0.0110, priority: 1 },
    });
  }
  console.log("  Created routes");

  // ─── Settings ─────────────────────────────────────────
  const settings = [
    { settingKey: "demo_mode", settingValue: "1", description: "Enable demo/simulator mode" },
    { settingKey: "demo_success_rate", settingValue: "85", description: "DLR success rate in demo mode" },
    { settingKey: "demo_min_delay", settingValue: "2", description: "Min DLR delay in seconds" },
    { settingKey: "demo_max_delay", settingValue: "15", description: "Max DLR delay in seconds" },
    { settingKey: "platform_name", settingValue: "SMSLocal BSS", description: "Platform display name" },
    { settingKey: "auto_refresh_interval", settingValue: "30", description: "Dashboard auto-refresh interval" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { settingKey: s.settingKey },
      update: {},
      create: s,
    });
  }
  console.log("  Created settings");

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
