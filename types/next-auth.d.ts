import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      role: "user" | "worker" | "admin";
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    role: "user" | "worker" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    role: "user" | "worker" | "admin";
  }
}
