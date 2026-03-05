import { NextResponse } from "next/server";

export async function POST() {
  const resp = NextResponse.json({ message: "Logged out" });
  resp.cookies.set("token", "", { httpOnly: true, maxAge: 0, path: "/" });
  return resp;
}
