import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/pin", "/api/pin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const authed = req.cookies.get("app_pin")?.value === process.env.APP_PIN;
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/pin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};
