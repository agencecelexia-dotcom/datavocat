import { NextResponse, type NextRequest } from "next/server";

// Demo mode: no auth check, pass through all requests
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
