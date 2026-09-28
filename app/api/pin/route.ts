import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  if (typeof pin !== "string" || pin !== process.env.APP_PIN) {
    return NextResponse.json({ error: "invalid pin" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("app_pin", pin, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
