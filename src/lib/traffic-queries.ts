import { prisma } from "./db";

export function getTimeCondition(period: string): {
  where: string;
  params: unknown[];
} {
  const p = parseInt(period);
  if (p > 0) {
    return {
      where: `m.submitted_at >= NOW() - INTERVAL '${p} minutes'`,
      params: [],
    };
  }
  if (p === 0) {
    return {
      where: `m.submitted_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,
      params: [],
    };
  }
  // yesterday
  return {
    where: `m.submitted_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'
             AND m.submitted_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,
    params: [],
  };
}

export async function getTrafficSummary(
  period: string,
  sortBy: string,
  filterType: string
) {
  const { where: timeWhere } = getTimeCondition(period);

  const typeFilter =
    filterType === "customer"
      ? "AND comp.type = 'customer'"
      : filterType === "vendor"
        ? "AND comp.type = 'vendor'"
        : "";

  const orderMap: Record<string, string> = {
    submitted: "submitted DESC",
    delivered: "successful DESC",
    failed: "failed DESC",
    dlr: "dlr DESC",
    asr: "asr DESC",
    name: "company_name ASC",
  };
  const orderBy = orderMap[sortBy] || "submitted DESC";

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      company_id: number;
      company_name: string;
      company_type: string;
      submitted: bigint;
      successful: bigint;
      failed: bigint;
      billable_c: bigint;
      billable_v: bigint;
      asr: number;
      dlr: number;
      cr: number;
      avg_rate_c: number;
      avg_rate_v: number;
    }>
  >(`
    SELECT
      comp.id as company_id,
      comp.name as company_name,
      comp.type::text as company_type,
      COUNT(m.id)::bigint as submitted,
      COUNT(CASE WHEN m.status IN ('sent','delivered','submitted') THEN 1 END)::bigint as successful,
      COUNT(CASE WHEN m.status = 'failed' THEN 1 END)::bigint as failed,
      COUNT(CASE WHEN m.selling_rate > 0 THEN 1 END)::bigint as billable_c,
      COUNT(CASE WHEN m.buying_rate > 0 THEN 1 END)::bigint as billable_v,
      COALESCE(
        ROUND(COUNT(CASE WHEN m.status IN ('sent','delivered','submitted') THEN 1 END) * 100.0 / NULLIF(COUNT(m.id), 0), 1),
        0
      ) as asr,
      COALESCE(
        ROUND(COUNT(CASE WHEN m.status = 'delivered' THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN m.status IN ('sent','delivered','submitted') THEN 1 END), 0), 1),
        0
      ) as dlr,
      COALESCE(
        ROUND(COUNT(CASE WHEN m.status = 'delivered' THEN 1 END) * 100.0 / NULLIF(COUNT(m.id), 0), 1),
        0
      ) as cr,
      COALESCE(AVG(CASE WHEN m.selling_rate > 0 THEN m.selling_rate END), 0) as avg_rate_c,
      COALESCE(AVG(CASE WHEN m.buying_rate > 0 THEN m.buying_rate END), 0) as avg_rate_v
    FROM sms_messages m
    LEFT JOIN companies comp ON comp.id = COALESCE(m.customer_id, (
      SELECT csa.company_id FROM customer_smpp_accounts csa WHERE csa.id = m.customer_account_id
    ))
    WHERE ${timeWhere}
      AND comp.id IS NOT NULL
      ${typeFilter}
    GROUP BY comp.id, comp.name, comp.type
    ORDER BY ${orderBy}
  `);

  return rows.map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    companyType: r.company_type,
    submitted: Number(r.submitted),
    successful: Number(r.successful),
    failed: Number(r.failed),
    billableC: Number(r.billable_c),
    billableV: Number(r.billable_v),
    asr: Number(r.asr),
    dlr: Number(r.dlr),
    cr: Number(r.cr),
    avgRateC: Number(r.avg_rate_c),
    avgRateV: Number(r.avg_rate_v),
  }));
}

