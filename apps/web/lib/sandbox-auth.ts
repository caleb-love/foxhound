import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export function isDashboardSandboxModeEnabled(): boolean {
  return process.env["FOXHOUND_UI_DEMO_MODE"] === "true";
}

export interface DashboardSessionLike {
  user: {
    id: string;
    name: string;
    email: string;
    token: string;
    orgId: string;
  };
}

export async function getDashboardSessionOrSandbox(): Promise<DashboardSessionLike> {
  const session = await getServerSession(authOptions);

  if (session) {
    return session as DashboardSessionLike;
  }

  if (isDashboardSandboxModeEnabled()) {
    return {
      user: {
        id: "sandbox-user",
        name: "Sandbox Operator",
        email: "sandbox@foxhound.local",
        token: "sandbox-token",
        orgId: "sandbox-org",
      },
    };
  }

  redirect("/login");
}
