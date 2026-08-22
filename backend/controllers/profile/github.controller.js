import User from "../../models/user.model.js";
import { exchangeGitHubCode, getGitHubUser, fetchGitHubStats } from "../../services/github.service.js";
import { calculateFyncScore } from "../../services/fyncScore.service.js";

// ─── Step 1: Get GitHub OAuth URL ─────────────────────────────────────────────
// Frontend opens this URL in a WebBrowser/InAppBrowser
export const getGitHubOAuthUrl = (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.GITHUB_REDIRECT_URI);
    const scope = "read:user,public_repo";
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${req.user._id}`;
    return res.json({ success: true, url });
};

// ─── Step 2: GitHub OAuth Callback ────────────────────────────────────────────
// GitHub redirects here with ?code=XXX&state=userId
export const githubOAuthCallback = async (req, res) => {
    try {
        const { code, state: userId } = req.query;
        if (!code || !userId) return res.status(400).json({ success: false, message: "Missing code or state" });

        // Exchange code for token
        const tokenData = await exchangeGitHubCode(code);
        if (!tokenData.access_token) {
            return res.status(400).json({ success: false, message: "GitHub OAuth failed — no token received" });
        }

        // Get GitHub user info
        const ghUser = await getGitHubUser(tokenData.access_token);

        // Save the connection FIRST.
        //
        // This used to fetch stats before saving anything, so any failure in the
        // stats call — a GraphQL error, a rate limit, a slow response — threw the
        // whole callback into its 500 handler and the token was never stored. The
        // account ended up not connected at all, and Dev Analytics stayed empty
        // with no way to retry, because Sync needs the token that was never saved.
        await User.findByIdAndUpdate(userId, {
            githubUsername: ghUser.login,
            githubAccessToken: tokenData.access_token, // consider encrypting in prod
            github_id: `https://github.com/${ghUser.login}`,
        });

        // Stats are best-effort: the user is connected either way and the Sync
        // button can fill them in.
        try {
            const stats = await fetchGitHubStats(ghUser.login, tokenData.access_token);
            await User.findByIdAndUpdate(userId, { githubStats: stats });
            await calculateFyncScore(userId);
        } catch (statsError) {
            console.error("GitHub stats fetch failed after connect:", statsError.message);
        }

        // Redirect back to app deep link (adjust scheme to your Expo app)
        return res.redirect(`${process.env.APP_DEEP_LINK_SCHEME}://github-connected?username=${ghUser.login}`);
    } catch (error) {
        console.error("githubOAuthCallback error:", error.message);
        return res.status(500).json({ success: false, message: "GitHub OAuth error", error: error.message });
    }
};

// ─── Step 3: Manual GitHub Sync ───────────────────────────────────────────────
// Re-fetches stats for users already connected (called by cron or "Sync" button)
export const syncGitHub = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("+githubAccessToken");

        if (!user.githubUsername) {
            return res.status(400).json({ success: false, message: "GitHub not connected. Use /github/connect first." });
        }

        // Throttle: disabled for testing
        // const lastFetched = user.githubStats?.lastFetched;
        // if (lastFetched) {
        //     const diffMs = Date.now() - new Date(lastFetched).getTime();
        //     const diffMins = diffMs / (1000 * 60);
        //     if (diffMins < 1) {
        //         return res.status(429).json({ success: false, message: "GitHub sync is throttled — please wait at least 1 minute between syncs.", nextSyncIn: `${Math.ceil(1 - diffMins)} minutes` });
        //     }
        // }

        const stats = await fetchGitHubStats(user.githubUsername, user.githubAccessToken);
        await User.findByIdAndUpdate(req.user._id, { githubStats: stats });
        await calculateFyncScore(req.user._id);

        return res.json({ success: true, message: "GitHub stats synced!", stats });
    } catch (error) {
        console.error("syncGitHub error:", error.message);
        // "Sync failed" told the user nothing. The two failures that actually
        // happen are a revoked token and GitHub's hourly rate limit, and they
        // need different actions from the user.
        const status = error?.response?.status;
        if (status === 401) {
            return res.status(401).json({
                success: false,
                message: "Your GitHub connection expired. Disconnect and connect again.",
            });
        }
        if (status === 403 || status === 429) {
            return res.status(429).json({
                success: false,
                message: "GitHub is rate limiting this account. Try again in an hour.",
            });
        }
        return res.status(502).json({ success: false, message: "GitHub did not respond. Try again shortly." });
    }
};

// ─── Disconnect GitHub ────────────────────────────────────────────────────────
export const disconnectGitHub = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            githubUsername: null,
            githubAccessToken: null,
            githubStats: {
                totalCommits: 0, totalRepos: 0, totalStars: 0,
                topLanguages: [], contributionStreak: 0,
                avatarUrl: null, bio: null, lastFetched: null
            }
        });
        await calculateFyncScore(req.user._id);
        return res.json({ success: true, message: "GitHub disconnected" });
    } catch (error) {
        console.error("disconnectGitHub error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
