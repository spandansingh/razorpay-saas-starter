import type { NextFetchEvent, NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './libs/I18nRouting';

const handleI18nRouting = createMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/:locale/dashboard(.*)',
  '/onboarding(.*)',
  '/:locale/onboarding(.*)',
]);

const isAuthPage = createRouteMatcher([
  '/sign-in(.*)',
  '/:locale/sign-in(.*)',
  '/sign-up(.*)',
  '/:locale/sign-up(.*)',
]);

// API routes that call auth()/requireOrgAdmin(). They aren't i18n or protected
// pages, so without this clerkMiddleware never runs on them and auth() throws
// "can't detect usage of clerkMiddleware()". Webhooks are excluded — they
// authenticate by signature, not Clerk. These are never locale-prefixed.
const isApiAuthRoute = createRouteMatcher([
  '/api/checkout(.*)',
  '/api/billing(.*)',
  '/api/uploads(.*)',
]);

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // Clerk keyless mode doesn't work with i18n, this is why we need to run the middleware conditionally
  if (
    isAuthPage(request) || isProtectedRoute(request) || isApiAuthRoute(request)
  ) {
    return clerkMiddleware(async (auth, req) => {
      // API routes only need the Clerk context attached so their auth() works;
      // they must not go through i18n routing, which would rewrite/redirect them.
      if (isApiAuthRoute(req)) {
        return NextResponse.next();
      }

      // Check if the current route is protected and requires authentication
      // If user is not authenticated, redirect them to the sign-in page with proper locale
      if (isProtectedRoute(req)) {
        const locale = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';

        const signInUrl = new URL(`${locale}/sign-in`, req.url);

        await auth.protect({
          unauthenticatedUrl: signInUrl.toString(),
        });
      }

      const authObj = await auth();

      // Redirect authenticated users without an organization to the organization selection page
      // This ensures users are properly associated with an organization before accessing the dashboard
      if (
        authObj.userId
        && !authObj.orgId
        && req.nextUrl.pathname.includes('/dashboard')
        && !req.nextUrl.pathname.endsWith('/organization-selection')
      ) {
        const orgSelection = new URL(
          '/onboarding/organization-selection',
          req.url,
        );

        return NextResponse.redirect(orgSelection);
      }

      return handleI18nRouting(req);
    })(request, event);
  }

  return handleI18nRouting(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
