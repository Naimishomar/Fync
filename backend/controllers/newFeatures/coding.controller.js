import axios from "axios";

const API_BASE = process.env.LEETCODE_API;

export const fetchLeetCodeStats = async (username) => {
    if (!username) return null;
    try {
        const { data } = await axios.get(`${API_BASE}/${username}/solved`);
        return {
            totalSolved: data.solvedProblem || 0,
            easy: data.easySolved || 0,
            medium: data.mediumSolved || 0,
            hard: data.hardSolved || 0
        };
    } catch (error) {
        return null;
    }
};

export const fetchFullLeetCodeProfile = async (username) => {
    if (!username) return null;
    try {
        const [
            profile, 
            solved, 
            badges, 
            contest, 
            acSubmissions, 
            calendar,
            skills, 
            languages
        ] = await Promise.all([
            axios.get(`${API_BASE}/${username}`),
            axios.get(`${API_BASE}/${username}/solved`),
            axios.get(`${API_BASE}/${username}/badges`),
            axios.get(`${API_BASE}/${username}/contest`),
            axios.get(`${API_BASE}/${username}/acSubmission?limit=15`), // Increased limit
            axios.get(`${API_BASE}/${username}/calendar`),
            axios.get(`${API_BASE}/${username}/skill`),
            axios.get(`${API_BASE}/${username}/language`)
        ]);

        return {
            profile: profile.data, // Contains school, company, about, etc.
            solved: solved.data,
            badges: badges.data.badges || [],
            contest: contest.data,
            recentSubmissions: acSubmissions.data.submission || [],
            submissionCalendar: calendar.data.submissionCalendar || "{}",
            skills: skills.data.data?.matchedUser?.tagProblemCounts || {},
            languages: languages.data.matchedUser?.languageProblemCount || []
        };
    } catch (error) {
        console.error(`❌ Full Profile Error (${username}):`, error.message);
        return null;
    }
};