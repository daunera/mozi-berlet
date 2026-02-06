
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Check for passcode authentication cookie for all requests
    const isAuthenticated = request.cookies.has('passcode_auth');

    // Only intercept requests to /backend
    if (request.nextUrl.pathname.startsWith('/backend')) {
        // If not authenticated, block backend calls
        if (!isAuthenticated) {
            return new NextResponse(
                JSON.stringify({ error: 'Unauthorized: Passcode required' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
            );
        }

        // Get the path after /backend
        const path = request.nextUrl.pathname.replace(/^\/backend/, '');
        const backendBaseUrl = process.env.BACKEND_URL || 'http://backend:8000/api';
        const backendUrl = `${backendBaseUrl}${path}${request.nextUrl.search}`;

        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('X-API-Key', process.env.API_KEY || '')

        return NextResponse.rewrite(new URL(backendUrl), {
            request: {
                headers: requestHeaders,
            },
        })
    }
}

export const config = {
    matcher: '/backend/:path*',
}
