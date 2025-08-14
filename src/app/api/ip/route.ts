
import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  // The 'x-forwarded-for' header is the standard way to get the original client IP.
  // The 'request.ip' property provided by Next.js/Vercel is a reliable fallback.
  const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? '127.0.0.1';
  return NextResponse.json({ ip });
}
