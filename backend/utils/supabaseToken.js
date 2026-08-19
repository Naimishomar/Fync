import jwt from "jsonwebtoken";

/**
 * Mints a Supabase-compatible JWT for the logged-in Fync user.
 *
 * The chat moved its data layer to Supabase, but the app never established a
 * Supabase auth session -- no signIn, no setSession anywhere. Every request the
 * client made therefore arrived as the anonymous role with `auth.uid()` NULL,
 * which means no row-level-security policy could identify the caller. For the
 * chat to work at all, RLS on `messages` and `conversations` has to be off or
 * fully permissive, and the anon key ships inside the APK where anyone can
 * extract it. That is every private message in the app readable, editable and
 * deletable by anybody who unzips the build.
 *
 * Supabase trusts any JWT signed with the project's JWT secret, so the backend
 * -- which already authenticates the user -- can issue one. `sub` carries the
 * Fync user id, and policies match on it via `auth.jwt() ->> 'sub'`.
 *
 * See docs/supabase-rls.sql for the policies this is meant to be paired with.
 * Until those are applied, this changes nothing about who can read what: it
 * only makes the identity available for the database to enforce against.
 */

const TTL_SECONDS = 60 * 60; // 1 hour; the client refreshes on demand.

export const isSupabaseAuthConfigured = () => Boolean(process.env.SUPABASE_JWT_SECRET);

export const mintSupabaseToken = (userId) => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return null;

    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            sub: String(userId),
            // Supabase's PostgREST reads `role` to pick the database role, and
            // rejects the token outright if `aud` is not "authenticated".
            role: "authenticated",
            aud: "authenticated",
            iat: now,
            exp: now + TTL_SECONDS,
        },
        secret,
        { algorithm: "HS256" }
    );
};

export const supabaseTokenTtlSeconds = TTL_SECONDS;
