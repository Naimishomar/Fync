import axios from "axios";

const GITHUB_API = "https://api.github.com";

/**
 * Fetch comprehensive public GitHub stats for a given username + access token.
 * Falls back to unauthenticated requests (60 req/hr limit) if no token is provided.
 */
export const fetchGitHubStats = async (username, accessToken = null) => {
    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const get = (url) => axios.get(url, { headers });

    // 1. Basic user info
    const { data: ghUser } = await get(`${GITHUB_API}/users/${username}`);

    // 2. Repos (up to 100, sort by pushed_at)
    const { data: repos } = await get(
        `${GITHUB_API}/users/${username}/repos?per_page=100&sort=pushed&type=owner`
    );

    // 3. Total stars across all repos
    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    // 4. Top languages (frequency map)
    const langMap = {};
    repos.forEach((r) => {
        if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
    });
    const topLanguages = Object.entries(langMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

    // 5. Commit count (sum of repo commit counts via /contributors, capped to avoid rate limits)
    let totalCommits = 0;
    for (const repo of repos.slice(0, 20)) {
        try {
            const { data: contributors } = await get(
                `${GITHUB_API}/repos/${username}/${repo.name}/contributors?per_page=100`
            );
            const me = contributors.find(
                (c) => c.login?.toLowerCase() === username?.toLowerCase()
            );
            if (me) totalCommits += me.contributions;
        } catch {
            // repo may be empty or inaccessible
        }
    }

    // 6. Contribution streak (via events — approximate, max 90 days back)
    let streak = 0;
    try {
        const { data: events } = await get(
            `${GITHUB_API}/users/${username}/events?per_page=100`
        );
        const pushDays = new Set(
            events
                .filter((e) => e.type === "PushEvent")
                .map((e) => e.created_at?.split("T")[0])
        );
        const today = new Date();
        for (let i = 0; i < 90; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split("T")[0];
            if (pushDays.has(key)) streak++;
            else if (i > 0) break; // streak broken
        }
    } catch {
        streak = 0;
    }

    return {
        totalCommits,
        totalRepos: ghUser.public_repos || 0,
        totalStars,
        topLanguages,
        contributionStreak: streak,
        avatarUrl: ghUser.avatar_url || null,
        bio: ghUser.bio || null,
        lastFetched: new Date()
    };
};

/**
 * Exchange a GitHub OAuth code for an access token.
 */
export const exchangeGitHubCode = async (code) => {
    const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code
        },
        { headers: { Accept: "application/json" } }
    );
    return response.data; // { access_token, scope, token_type }
};

/**
 * Get the authenticated GitHub user's login (username).
 */
export const getGitHubUser = async (accessToken) => {
    const { data } = await axios.get(`${GITHUB_API}/user`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json"
        }
    });
    return data; // { login, id, avatar_url, bio, ... }
};
