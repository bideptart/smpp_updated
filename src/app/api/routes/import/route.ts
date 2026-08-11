import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

/**
 * CSV/Excel import format expected:
 * customerName,vendorName,countryCode,numberPrefix,operatorName,sellingRate,buyingRate,priority,weight
 * Acme Corp,Acepeak,91,,Airtel,40.0000,39.0000,1,100
 *
 * customerName/vendorName are matched case-insensitively against existing
 * Companies (scoped to type customer/vendor). operatorName is optional —
 * leave blank for a country-wide (not operator-specific) rate. weight is
 * optional (defaults to 100) and only matters once a second route shares
 * the same customer+country+priority with a different vendor -- it then
 * decides the traffic split between them (see pickWeightedRoute). Re-
 * importing the same customer+vendor+countryCode+numberPrefix+operatorName
 * combination updates the existing route's rates/priority/weight instead of
 * creating a duplicate, so a country-wide row and an operator-specific row
 * for the same country coexist without colliding.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { rows } = body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ success: false, error: "rows array required" }, { status: 400 });
    }

    const [customers, vendors] = await Promise.all([
      prisma.company.findMany({ where: { type: "customer" }, select: { id: true, name: true } }),
      prisma.company.findMany({ where: { type: "vendor" }, select: { id: true, name: true } }),
    ]);
    const findCompany = (list: typeof customers, name: string) =>
      list.find((c) => c.name.toLowerCase() === String(name || "").trim().toLowerCase());

    // One shared batchId per import request — the Routes page groups rows by
    // (customerId, vendorId, batchId), so a sheet covering several customers
    // still splits into one group per customer+vendor pair, not one giant group.
    const batchId = crypto.randomUUID();
    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const customerName = row.customerName || row.customer || "";
        const vendorName = row.vendorName || row.vendor || "";
        const countryCode = String(row.countryCode || "").trim();
        const numberPrefix = String(row.numberPrefix || "").trim();
        const operatorName = String(row.operatorName || "").trim() || null;
        const sellingRate = parseFloat(row.sellingRate);
        const buyingRate = parseFloat(row.buyingRate);
        const priority = row.priority ? parseInt(row.priority, 10) : 1;
        const weight = row.weight ? parseInt(row.weight, 10) : 100;

        const customer = findCompany(customers, customerName);
        if (!customer) {
          failed++;
          errors.push({ row: rowNum, reason: `Customer "${customerName}" not found` });
          continue;
        }
        const vendor = findCompany(vendors, vendorName);
        if (!vendor) {
          failed++;
          errors.push({ row: rowNum, reason: `Vendor "${vendorName}" not found` });
          continue;
        }
        if (!countryCode) {
          failed++;
          errors.push({ row: rowNum, reason: "countryCode is required" });
          continue;
        }
        if (Number.isNaN(sellingRate) || Number.isNaN(buyingRate)) {
          failed++;
          errors.push({ row: rowNum, reason: "sellingRate and buyingRate must be numbers" });
          continue;
        }

        const name =
          row.name ||
          `${countryCode}${operatorName ? ` ${operatorName}` : ""} ${customer.name} → ${vendor.name}`;

        const existing = await prisma.route.findFirst({
          where: {
            customerId: customer.id,
            vendorId: vendor.id,
            countryCode,
            numberPrefix,
            operatorName,
          },
        });

        if (existing) {
          await prisma.route.update({
            where: { id: existing.id },
            data: { sellingRate, buyingRate, priority, weight },
          });
          updated++;
        } else {
          await prisma.route.create({
            data: {
              name,
              customerId: customer.id,
              vendorId: vendor.id,
              countryCode,
              numberPrefix,
              operatorName,
              sellingRate,
              buyingRate,
              priority,
              weight,
              isActive: true,
              batchId,
            },
          });
          imported++;
        }
      } catch (e) {
        failed++;
        errors.push({ row: rowNum, reason: String(e) });
      }
    }

    return Response.json({
      success: true,
      data: { imported, updated, failed, total: rows.length, errors: errors.slice(0, 20) },
    });
  } catch (error) {
    console.error("Route import error:", error);
    return Response.json({ success: false, error: "Import failed" }, { status: 500 });
  }
}
