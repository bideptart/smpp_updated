import prisma from "@/lib/db";

/**
 * Checks a message against active content filters (global + this customer's).
 * Content moderation happens here, at submit time, rather than inside
 * Jasmin — Jasmin's filters pick a route, they can't reject a submission
 * and tell the caller why.
 */
export async function checkContentFilters(
  customerId: number,
  messageText: string
): Promise<{ blocked: boolean; keyword?: string }> {
  const filters = await prisma.contentFilter.findMany({
    where: {
      isActive: true,
      action: "block",
      OR: [{ customerId: null }, { customerId }],
    },
  });

  const lowerText = messageText.toLowerCase();
  for (const f of filters) {
    if (lowerText.includes(f.keyword.toLowerCase())) {
      return { blocked: true, keyword: f.keyword };
    }
  }
  return { blocked: false };
}
