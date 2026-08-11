import { auth } from "./auth";
import { prisma } from "./db";

export interface SessionUser {
  id: number;
  role: "super_admin" | "admin" | "user" | "operator" | "viewer";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const id = parseInt(String((session.user as { id?: string | number }).id));
  const role = (session.user as { role?: string }).role as SessionUser["role"];
  if (!id || !role) return null;
  return { id, role };
}

/**
 * Given a caller, returns the `where` clause for users they're allowed to see.
 * - super_admin: sees all admins + users (not other super admins, unless viewing all)
 * - admin: sees only users they invited (ownerId = them)
 * - user/operator/viewer: sees only themselves
 */
// Using a permissive type here because Prisma's generated where types are
// narrow and this function composes a few different shapes for different
// caller roles. The runtime shape is always a valid UserWhereInput.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeForCaller(caller: SessionUser): any {
  if (caller.role === "super_admin") {
    // Super admin sees:
    //   - All admins
    //   - Standalone users (no admin owner): ownerId IS NULL, or
    //     owner happens to be a super admin (direct invite from super admin)
    return {
      OR: [
        { role: "admin" },
        { role: "user", ownerId: null },
        { role: "user", owner: { role: "super_admin" } },
      ],
    };
  }
  if (caller.role === "admin") {
    // Admin sees everyone they invited (both users and admins)
    return { ownerId: caller.id, role: { in: ["admin", "user"] } };
  }
  // Other roles only see themselves
  return { id: caller.id };
}

/**
 * Which roles can this caller create?
 */
export function creatableRoles(
  callerRole: SessionUser["role"]
): ("admin" | "user")[] {
  if (callerRole === "super_admin") return ["admin", "user"];
  if (callerRole === "admin") return ["admin", "user"];
  return [];
}

/**
 * Roles allowed to create/update/delete data. `viewer` is read-only
 * everywhere in the app.
 */
export function canMutate(role: SessionUser["role"]): boolean {
  return role !== "viewer";
}

/**
 * Roles allowed to manage the Jasmin gateway (connectors, routes, routing
 * mode) — this directly controls live SMS delivery infrastructure, so it's
 * gated tighter than the general canMutate() check.
 */
export function isGatewayAdmin(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * Verify caller is allowed to operate on the given target user.
 * Returns the target user record or null if forbidden/not-found.
 */
export async function assertCanManage(
  caller: SessionUser,
  targetId: number
): Promise<{ id: number; role: string; ownerId: number | null } | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      role: true,
      ownerId: true,
      owner: { select: { role: true } },
    },
  });
  if (!target) return null;

  if (caller.role === "super_admin") {
    // Super admin can manage:
    //   - Themselves
    //   - Any admin
    //   - Standalone users (no owner, or owner is a super admin)
    // They cannot manage users that belong to an admin.
    if (target.id === caller.id) return target;
    if (target.role === "admin") return target;
    if (target.role === "user") {
      const ownerRole = target.owner?.role;
      if (target.ownerId === null || ownerRole === "super_admin") return target;
    }
    return null;
  }
  if (caller.role === "admin") {
    // Admin can manage anyone they invited (both users and admins)
    if (target.ownerId !== caller.id) return null;
    if (target.role !== "user" && target.role !== "admin") return null;
    return target;
  }
  // Others can only manage themselves
  if (target.id === caller.id) return target;
  return null;
}
