import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "./auth-config";

interface AdminPageProps {
  title: string;
}

export async function requireAdminPage(
  context: GetServerSidePropsContext,
  title: string
): Promise<GetServerSidePropsResult<AdminPageProps>> {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user) {
    const callbackUrl = encodeURIComponent(context.resolvedUrl || "/admin");
    return {
      redirect: {
        destination: `/login?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  if (session.user.role !== "admin") {
    return {
      redirect: {
        destination: "/403",
        permanent: false,
      },
    };
  }

  context.res.setHeader("Cache-Control", "no-store");

  return {
    props: {
      title,
    },
  };
}
