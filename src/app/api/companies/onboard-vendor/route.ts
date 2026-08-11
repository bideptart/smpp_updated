import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { CompanyType, ConnectionType } from "@/generated/prisma";
import { getSessionUser, canMutate, isGatewayAdmin } from "@/lib/user-scope";
import { encrypt } from "@/lib/encrypt";
import { auditLog } from "@/lib/audit";
import { addConnector, syncVendorRouting } from "@/lib/jasmin-cli";

function sanitizeCid(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * One-shot vendor onboarding: creates the Company, and — if connection
 * details were supplied — the matching Connection row plus (for gateway
 * admins) the real Jasmin connector and its vendor-tag route, instead of
 * requiring three separate manual visits to Companies/Connections/Gateway.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { name, code, contactName, contactEmail, contactPhone, isActive, balance, currency, connection } = body;

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
        type: "vendor" as CompanyType,
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
      details: { name: company.name, code: company.code, type: "vendor" },
    });

    const result: {
      company: typeof company;
      connection?: { id: number; name: string };
      jasmin?: { success: boolean; message: string };
      note?: string;
    } = { company };

    if (connection?.host && connection?.username && connection?.password) {
      const cid = sanitizeCid(company.code);
      const port = connection.port ? Number(connection.port) : 2775;

      const conn = await prisma.connection.create({
        data: {
          companyId: company.id,
          name: cid,
          type: "SMPP" as ConnectionType,
          direction: "MT",
          host: connection.host,
          port,
          username: connection.username,
          password: encrypt(connection.password),
          maxTps: connection.maxTps ? Number(connection.maxTps) : 10,
          status: "active",
        },
      });
      result.connection = { id: conn.id, name: conn.name };

      await auditLog({
        userId: caller.id,
        action: "connection_created",
        resource: "connection",
        resourceId: conn.id,
        details: { name: conn.name, type: conn.type, companyId: conn.companyId },
      });

      if (isGatewayAdmin(caller.role)) {
        const jasminResult = await addConnector({
          cid,
          host: connection.host,
          port,
          username: connection.username,
          password: connection.password,
          bind: "transceiver",
        });
        result.jasmin = jasminResult;

        if (jasminResult.success) {
          await syncVendorRouting();
        } else {
          result.note = `Vendor and connection created, but Jasmin connector setup failed: ${jasminResult.message} — complete it manually on the Gateway page.`;
        }
      } else {
        result.note = "Vendor and connection created. Ask an admin to finish Jasmin setup on the Gateway page.";
      }
    }

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Vendor onboarding error:", error);
    return Response.json(
      { success: false, error: "Failed to onboard vendor" },
      { status: 500 }
    );
  }
}
