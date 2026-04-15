/**
 * NextAuth type extensions for custom session/token fields
 */

import "next-auth";


declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    token: string;
    orgId: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      token: string;
      orgId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    token: string;
    orgId: string;
  }
}
