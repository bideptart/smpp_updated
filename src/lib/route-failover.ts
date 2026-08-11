import type { PrismaClient } from "../generated/prisma";

/**
 * Weighted-random pick among the routes at the single best (lowest-number)
 * priority tier that has any matches -- priority still decides "try this
 * vendor before that one" (manual failover ordering, unchanged), weight
 * only decides the split *within* a tier of equally-prioritized vendors
 * for the same customer+country (e.g. two routes both at priority 1,
 * weight 80 and weight 20, split real traffic ~80/20 between vendors).
 * A single matching route always wins regardless of its weight value --
 * weight only matters once a second candidate exists at the same
 * priority, so every existing single-vendor setup is unaffected.
 */
export function pickWeightedRoute<T extends { priority: number; weight: number }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  const bestPriority = Math.min(...candidates.map((r) => r.priority));
  const tier = candidates.filter((r) => r.priority === bestPriority);
  if (tier.length === 1) return tier[0];

  const totalWeight = tier.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  if (totalWeight <= 0) return tier[0];

  let roll = Math.random() * totalWeight;
  for (const r of tier) {
    roll -= Math.max(0, r.weight);
    if (roll < 0) return r;
  }
  return tier[tier.length - 1];
}

/**
 * Extracted from smpp-daemon.ts's sendViaJasmin() so both the Jasmin and
 * direct-SMPP send paths can retry via the same next-priority-route logic
 * without importing from each other (avoids a circular dependency between
 * smpp-daemon.ts and src/lib/direct-smpp.ts).
 */
export async function findNextRoute(
  prisma: PrismaClient,
  customerId: number,
  destination: string,
  excludeRouteIds: number[]
) {
  const candidates = await prisma.route.findMany({
    where: {
      customerId,
      isActive: true,
      id: { notIn: excludeRouteIds },
    },
    orderBy: { priority: "asc" },
    include: { vendor: { include: { connections: { select: { name: true, transport: true }, take: 1 } } } },
  });
  const matches = candidates.filter(
    (r) => r.numberPrefix === "" || destination.startsWith(r.numberPrefix)
  );
  return pickWeightedRoute(matches);
}
