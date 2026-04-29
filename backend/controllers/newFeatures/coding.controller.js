import axios from "axios";
import dotenv from "dotenv";
dotenv.config({quiet: true});
const API_BASE = process.env.LEETCODE_API;

export const fetchLeetCodeStats = async (username) => {
    if (!username) return null;
    try {
        const [solvedRes, calendarRes] = await Promise.all([
            axios.get(`${API_BASE}/${username}/solved`),
            axios.get(`${API_BASE}/${username}/calendar`)
        ]);

        const solved = solvedRes.data;
        const calendar = JSON.parse(calendarRes.data.submissionCalendar || "{}");
        
        // Calculate Rolling 7 Days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let sevenDayCount = 0;

        Object.keys(calendar).forEach(timestamp => {
            const date = new Date(parseInt(timestamp) * 1000);
            date.setHours(0, 0, 0, 0);
            const diffTime = Math.abs(today - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7) {
                sevenDayCount += calendar[timestamp];
            }
        });

        return {
            totalSolved: solved.solvedProblem || 0,
            easy: solved.easySolved || 0,
            medium: solved.mediumSolved || 0,
            hard: solved.hardSolved || 0,
            sevenDayCount
        };
    } catch (error) {
        console.error("LeetCode Fetch Error:", error.message);
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