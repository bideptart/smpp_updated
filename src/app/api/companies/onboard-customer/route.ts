import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { CompanyType } from "@/generated/prisma";
import { randomHex, generatePassword } from "@/lib/sms-engine";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { auditLog } from "@/lib/audit";

/**
 * One-shot customer onboarding: creates the Company, and — if requested —
 * the matching CustomerSmppAccount in the same step, instead of requiring a
 * separate visit to the Customers (SMPP Accounts) page afterward. Reuses
 * the exact same auto-generation defaults as customer-accounts/route.ts.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { name, code, contactName, contactEmail, contactPhone, isActive, balance, currency, smppAccount } = body;

    if (!name || !code) {
      return Response.json(
        { success: false, error: "Name and code are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.company.findUnique({ where: { code: String(code).toUpperCase() } });
    if (existing) {
      return Response.json(
        { success: false, error: "A company with this code already exists" },
        { status: 409 }
      );
    }

    const company = await prisma.company.create({
      data: {
        name,
        code: String(code).toUpperCase(),
        type: "customer" as CompanyType,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        isActive: isActive ?? true,
        balance: balance != null ? Number(balance) : 0,
        currency: currency || "INR",
      },
    });

    await auditLog({
      userId: caller.id,
      action: "company_created",
      resource: "company",
      resourceId: company.id,
      details: { name: company.name, code: company.code, type: "customer" },
    });

    const result: {
      company: typeof company;
      credentials?: { systemId: string; password: string; smppHost: string; smppPort: number };
    } = { company };

    if (smppAccount) {
      const finalSystemId = smppAccount.systemId || `BSS${randomHex(6).toUpperCase()}`;
      const finalPassword = smppAccount.password || generatePassword(8);

      const existingAccount = await prisma.customerSmppAccount.findUnique({
        where: { systemId: finalSystemId },
      });
      if (existingAccount) {
        return Response.json(
          { success: true, data: { company }, note: "Company created, but System ID already exists — create the SMPP account separately with a different ID." },
          { status: 201 }
        );
      }

      await prisma.customerSmppAccount.create({
        data: {
          companyId: company.id,
          accountName: smppAccount.accountName || null,
          systemId: finalSystemId,
          password: await bcrypt.hash(finalPassword, 10),
          allowedIps: smppAccount.allowedIps || "*",
          maxConnections: smppAccount.maxConnections ?? 2,
          maxTps: smppAccount.maxTps ?? 10,
          speedLimit: smppAccount.speedLimit ?? 10,
          bindMode: smppAccount.bindMode || "TRX",
          chargingModel: smppAccount.chargingModel || "submission",
          enableDelivery: smppAccount.enableDelivery ?? "yes",
        },
      });

      result.credentials = {
        systemId: finalSystemId,
        password: finalPassword,
        smppHost: "smpp.smslocal.in",
        smppPort: 2775,
      };
    }

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Customer onboarding error:", error);
    return Response.json(
      { success: false, error: "Failed to onboard customer" },
      { status: 500 }
    );
  }
}
