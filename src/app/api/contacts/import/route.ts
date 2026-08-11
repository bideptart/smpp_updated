import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

/**
 * CSV import format expected:
 * phone,firstName,lastName,email,company,country
 * 919876543210,John,Doe,john@example.com,Acme,IN
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, rows, listId } = body;

    if (!customerId || !Array.isArray(rows)) {
      return Response.json({ success: false, error: "customerId and rows required" }, { status: 400 });
    }

    const cid = parseInt(customerId);
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const phone = String(row.phone || row.phoneNumber || row.mobile || "")
          .replace(/\s+/g, "")
          .replace(/^\+/, "");
        if (!phone || phone.length < 7) {
          failed++;
          errors.push(`Invalid phone: ${row.phone}`);
          continue;
        }

        // Check duplicate
        const existing = await prisma.contact.findFirst({
          where: { customerId: cid, phoneNumber: phone },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const contact = await prisma.contact.create({
          data: {
            customerId: cid,
            phoneNumber: phone,
            firstName: row.firstName || row.first_name || null,
            lastName: row.lastName || row.last_name || null,
            email: row.email || null,
            company: row.company || null,
            country: row.country || null,
          },
        });

        if (listId) {
          await prisma.contactListEntry.create({
            data: { listId: parseInt(listId), contactId: contact.id },
          }).catch(() => {}); // ignore duplicate
        }

        success++;
      } catch (e) {
        failed++;
        errors.push(String(e));
      }
    }

    // Update list count
    if (listId) {
      const count = await prisma.contactListEntry.count({ where: { listId: parseInt(listId) } });
      await prisma.contactList.update({
        where: { id: parseInt(listId) },
        data: { contactCount: count },
      });
    }

    return Response.json({
      success: true,
      imported: success,
      failed,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("Import error:", error);
    return Response.json({ success: false, error: "Import failed" }, { status: 500 });
  }
}
