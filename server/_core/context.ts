import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME, MEMBER_COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { getMemberBySessionToken } from "../memberAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  accountId?: number;
  isMember?: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let accountId: number | undefined;
  let isMember = false;

  const cookies = parseCookie(opts.req.headers.cookie ?? "");
  const memberAccount = await getMemberBySessionToken(cookies[MEMBER_COOKIE_NAME] ?? "");

  if (memberAccount) {
    user = {
      id: -memberAccount.id,
      openId: `member:${memberAccount.id}`,
      name: memberAccount.userName,
      email: memberAccount.email,
      loginMethod: "password",
      role: "user",
      createdAt: memberAccount.createdAt,
      updatedAt: memberAccount.updatedAt,
      lastSignedIn: memberAccount.createdAt,
    };
    accountId = memberAccount.id;
    isMember = true;
  }

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    accountId,
    isMember,
  };
}
