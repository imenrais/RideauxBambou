import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "./auth-config";
import { getLiveUserRole } from "./live-role";

/**
 * Server-side guard for admin pages.
 * Non-admins get a real HTTP 404 (same as a missing page) — never a login redirect.
 * Role is re-checked live from the database so demotions apply immediately.
 */
export async function requireAdminPage(
  context: GetServerSidePropsContext
): Promise<GetServerSidePropsResult<Record<string, never>>> {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return { notFound: true };
  }

  const liveRole = await getLiveUserRole(session.user.id);
  if (liveRole !== "admin") {
    return { notFound: true };
  }

  return { props: {} };
}
