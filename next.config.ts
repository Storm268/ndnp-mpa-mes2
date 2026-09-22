import type { NextConfig } from "next";

// NEXT_PUBLIC_ vars baked at build time for production Vercel deployments
const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      "https://rorhyvgmkfscjhsrkwwv.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcmh5dmdta2ZzY2poc3Jrd3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTMyNzQsImV4cCI6MjA5NTk4OTI3NH0.VNgI_kiK-WtQaP1MN6Zj8iQ4-K5RWnhc9QUY49meG1Q",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcmh5dmdta2ZzY2poc3Jrd3d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQxMzI3NCwiZXhwIjoyMDk1OTg5Mjc0fQ.GqFapLdxpL6mhgk6_zKuuFlWzN3cTorV4vVdj_lJ0XU",
  },
};

export default nextConfig;

