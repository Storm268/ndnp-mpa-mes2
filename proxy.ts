import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { UserRole } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/lib/supabase/client";

const ALLOWED_ORIGINS = [
  "https://codewords.agemo.ai",
  "https://codewords-staging.agemo.ai",
  "http://localhost:3000",
  "http://localhost:3001",
];

const FRAME_ANCESTORS =
  "'self' *.agemo.ai *.codewords.run *.codewords.click *.ngrok.app *.ngrok.dev localhost:3000 localhost:3001";

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".ngrok.app")) return true;
  if (origin.endsWith(".ngrok.dev")) return true;
  if (origin.endsWith(".codewords.run")) return true;
  if (origin.endsWith(".codewords.click")) return true;
  return false;
};

const SKIP_PATHS = ["/_next", "/favicon.ico", "/health", "/api/health", "/api/cw-auth"];

// Public paths — no auth required (page handles its own state)
const PUBLIC_PATHS = ["/register", "/report"];

const CODEWORDS_APP_URL =
  process.env.CODEWORDS_APP_URL || "https://codewords.agemo.ai";

const AUTH_HANDSHAKE_HTML = `<!DOCTYPE html>
<html><head><title>Authenticating...</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#666">
<div style="text-align:center">
<p id="cw-auth-msg">Authenticating...</p>
<script>
(function() {
  var projectId = '${process.env.CODEWORDS_PROJECT_ID || ""}' || location.hostname.split('.')[0];
  var grantUrl = '${CODEWORDS_APP_URL}/api/auth/preview-grant?project_id=' + encodeURIComponent(projectId) + '&redirect=' + encodeURIComponent(location.href);
  var done = false;
  var loops = 0;
  var now = Date.now();
  try {
    var prev = JSON.parse(sessionStorage.getItem('cw_auth_loops') || '{}');
    if (prev && typeof prev.t === 'number' && now - prev.t < 15000) { loops = prev.n || 0; }
  } catch (e) {}
  function showFallback() {
    var msg = document.getElementById('cw-auth-msg');
    if (!msg) return;
    msg.innerHTML = 'Sign in to view this preview.<br>' +
      '<a href="' + grantUrl + '" target="_blank" rel="noopener" style="color:#2563eb;display:inline-block;margin-top:8px">Open preview &rarr;</a>';
  }
  if (loops >= 3) { showFallback(); return; }
  try { sessionStorage.setItem('cw_auth_loops', JSON.stringify({ n: loops + 1, t: now })); } catch (e) {}
  function requestToken() { try { window.parent.postMessage({ type: 'cw-auth-request', projectId: projectId }, '*'); } catch (e) {} }
  window.addEventListener('message', function(e) {
    if (done) return;
    if (e.data && e.data.type === 'cw-auth-token' && e.data.otk) {
      done = true;
      var url = new URL(location.href);
      url.searchParams.set('cw_otk', e.data.otk);
      location.href = url.toString();
    }
  });
  requestToken();
  var attempts = 0;
  var poll = setInterval(function() {
    attempts++;
    if (done) { clearInterval(poll); return; }
    if (attempts > 8) { clearInterval(poll); showFallback(); return; }
    requestToken();
  }, 700);
})();
</script>
</div></body></html>`;

// ── Supabase auth helper ───────────────────────────────────────────────────
async function handleSupabaseAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Public pages — pass through, page handles its own auth state
  const isPublic = pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    // Still refresh session cookies so auth state is current
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.next();
    let response = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    // Refresh session
    await supabase.auth.getUser();
    return response;
  }

  const isProtected = pathname.startsWith("/dashboard");
  const isLoginPage = pathname.startsWith("/login");
  if (!isProtected && !isLoginPage) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/operational";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}

// ── Localhost / dev bypass ───────────────────────────────────────────────────
function isLocalhost(request: NextRequest): boolean {
  const hostname = request.nextUrl.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    process.env.NODE_ENV === "development"
  );
}

// ── Main proxy export ─────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next(), request);
  }

  // Handle preflight
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS" && origin && isAllowedOrigin(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // ── LOCAL DEVELOPMENT BYPASS ─────────────────────────────────────────────
  if (isLocalhost(request)) {
    const sbResult = await handleSupabaseAuth(request);
    return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
  }

  const previewAuth = process.env.CODEWORDS_PREVIEW_AUTH;

  if (!previewAuth) {
    const accessToken = process.env.CODEWORDS_ACCESS_TOKEN;
    if (!accessToken) {
      const sbResult = await handleSupabaseAuth(request);
      return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
    }
    const queryToken = searchParams.get("cw_token");
    if (queryToken === accessToken) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("cw_token");
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set("cw_access", accessToken, { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 60 * 60 * 24 });
      return addSecurityHeaders(response, request);
    }
    const cookieToken = request.cookies.get("cw_access")?.value;
    if (cookieToken === accessToken) {
      const sbResult = await handleSupabaseAuth(request);
      return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
    }
    // Public paths bypass CodeWords token check
    if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      const sbResult = await handleSupabaseAuth(request);
      return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
    }
    return addSecurityHeaders(new NextResponse("Unauthorized", { status: 401 }), request);
  }

  // === Preview auth flow ===
  const previewCookie = request.cookies.get("cw_preview")?.value;
  if (previewCookie === "1") {
    const sbResult = await handleSupabaseAuth(request);
    return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
  }

  const accessToken = process.env.CODEWORDS_ACCESS_TOKEN;
  if (accessToken) {
    const queryToken = searchParams.get("cw_token");
    if (queryToken === accessToken) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("cw_token");
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set("cw_access", accessToken, { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 60 * 60 * 24 });
      return addSecurityHeaders(response, request);
    }
    const cookieToken = request.cookies.get("cw_access")?.value;
    if (cookieToken === accessToken) {
      const sbResult = await handleSupabaseAuth(request);
      return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
    }
  }

  // Public paths bypass preview auth redirect
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const sbResult = await handleSupabaseAuth(request);
    return addSecurityHeaders(sbResult ?? NextResponse.next(), request);
  }

  const otk = searchParams.get("cw_otk");
  if (otk) {
    const runtimeUri = process.env.CODEWORDS_RUNTIME_URI;
    const projectId = process.env.CODEWORDS_PROJECT_ID || request.nextUrl.hostname.split(".")[0];
    if (runtimeUri) {
      const verifyRedirect = new URL("/api/cw-auth", request.nextUrl.origin);
      verifyRedirect.searchParams.set("otk", otk);
      verifyRedirect.searchParams.set("project_id", projectId);
      verifyRedirect.searchParams.set("redirect", (() => { const c = request.nextUrl.clone(); c.searchParams.delete("cw_otk"); return c.toString(); })());
      return NextResponse.redirect(verifyRedirect);
    }
  }

  const accept = request.headers.get("accept") || "";
  const isIframe = request.headers.get("sec-fetch-dest") === "iframe";
  if (isIframe) {
    return addSecurityHeaders(new NextResponse(AUTH_HANDSHAKE_HTML, { status: 200, headers: { "Content-Type": "text/html" } }), request);
  }
  if (!accept.includes("text/html")) {
    return addSecurityHeaders(new NextResponse("Unauthorized", { status: 401 }), request);
  }
  const projectId = process.env.CODEWORDS_PROJECT_ID || request.nextUrl.hostname.split(".")[0];
  const grantUrl = new URL("/api/auth/preview-grant", CODEWORDS_APP_URL);
  grantUrl.searchParams.set("project_id", projectId);
  grantUrl.searchParams.set("redirect", request.nextUrl.toString());
  return NextResponse.redirect(grantUrl.toString());
}

function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  response.headers.set("Content-Security-Policy", `frame-ancestors ${FRAME_ANCESTORS}`);
  return response;
}

export const config = { matcher: "/:path*" };

