import User from "../models/user.model.js";
import FyncScore from "../models/profile/fyncScore.model.js";
import UserProject from "../models/profile/project.model.js";
import Internship from "../models/profile/internship.model.js";

// ─── Badge Thresholds ─────────────────────────────────────────────────────────
const getBadge = (score) => {
    if (score >= 850) return "Legend";
    if (score >= 650) return "Pioneer";
    if (score >= 450) return "Innovator";
    if (score >= 250) return "Builder";
    if (score >= 100) return "Explorer";
    return "Newcomer";
};

// ─── Sub-Score Calculators ────────────────────────────────────────────────────

const calcHackathonScore = async (userId) => {
    // Dynamically import to avoid circular deps
    const { default: HackathonTeam } = await import("../models/hackathon/team.model.js").catch(() => ({ default: null }));
    const { default: HackathonSubmission } = await import("../models/hackathon/submission.model.js").catch(() => ({ default: null }));

    let participated = 0, submitted = 0, won = 0;

    if (HackathonTeam) {
        participated = await HackathonTeam.countDocuments({
            $or: [{ leader: userId }, { "members.user": userId }]
        });
    }
    if (HackathonSubmission) {
        submitted = await HackathonSubmission.countDocuments({ submittedBy: userId });
    }

    // Score formula: 30 per participation, 20 per submission, 50 per win (capped at 200)
    const raw = (participated * 30) + (submitted * 20) + (won * 50);
    return {
        score: Math.min(raw, 200),
        participated,
        won,
        submitted
    };
};

const calcCodingScore = async (user) => {
    const leetcode = user.codingStats?.leetcodeSolved || 0;
    const gfg = user.codingStats?.gfgSolved || 0;
    const oneVsOneWins = user.oneVsOnePoints || 0;

    // 0.5 per solved (capped at 150), 0.5 per 1v1 win (capped at 50)
    const codingRaw = Math.min((leetcode + gfg) * 0.5, 150);
    const arenaRaw = Math.min(oneVsOneWins * 0.5, 50);
    const raw = codingRaw + arenaRaw;

    return {
        score: Math.min(Math.round(raw), 200),
        leetcodeSolved: leetcode,
        gfgSolved: gfg,
        oneVsOneWins
    };
};

const calcGitHubScore = (user) => {
    const stats = user.githubStats || {};
    if (!user.githubUsername) return { score: 0, ...stats };

    const commits = stats.totalCommits || 0;
    const repos   = stats.totalRepos   || 0;
    const stars   = stats.totalStars   || 0;
    const streak  = stats.contributionStreak || 0;

    // Weighted: commits×0.3 + repos×2 + stars×1 + streak×2 (capped at 150)
    const raw = (commits * 0.3) + (repos * 2) + (stars * 1) + (streak * 2);
    return {
        score: Math.min(Math.round(raw), 150),
        totalCommits: commits,
        totalRepos: repos,
        totalStars: stars,
        streak
    };
};

const calcProjectScore = async (userId) => {
    const projects = await UserProject.find({ user: userId, isPublic: true });
    const count = projects.length;
    const totalLikes = projects.reduce((sum, p) => sum + (p.likes?.length || 0), 0);

    // 20 per project (capped at 100), 1 per like (capped at 50)
    const raw = Math.min(count * 20, 100) + Math.min(totalLikes, 50);
    return {
        score: Math.min(Math.round(raw), 150),
        count,
        totalLikes
    };
};

const calcEventScore = async (userId) => {
    // Basic community engagement — expand when Events model tracks attendance
    let attended = 0, asSpeaker = 0;
    try {
        const { default: EventRegistration } = await import("../models/events/eventRegistration.model.js").catch(() => ({ default: null }));
        if (EventRegistration) {
            attended = await EventRegistration.countDocuments({ user: userId });
        }
    } catch { /* model may not exist yet */ }

    const raw = (attended * 10) + (asSpeaker * 30);
    return {
        score: Math.min(Math.round(raw), 100),
        attended,
        asSpeaker
    };
};

const calcInternshipScore = async (userId) => {
    const internships = await Internship.find({ user: userId });
    const count = internships.length;

    // Calculate total months of experience
    let totalMonths = 0;
    internships.forEach((i) => {
        const end = i.isCurrentlyWorking ? new Date() : (i.endDate || new Date());
        const start = i.startDate || end;
        const months = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30)));
        totalMonths += months;
    });

    // 30 per internship (capped at 90) + 5 per month (capped at 60)
    const raw = Math.min(count * 30, 90) + Math.min(totalMonths * 5, 60);
    return {
        score: Math.min(Math.round(raw), 150),
        count,
        totalMonths
    };
};

const calcCommunityScore = async (user) => {
    const followers = user.followers?.length || 0;
    // Posts will be approximate — expand with a Post.countDocuments if needed
    const posts = 0;

    // 0.5 per follower (capped at 30) + 2 per post (capped at 20)
    const raw = Math.min(followers * 0.5, 30) + Math.min(posts * 2, 20);
    return {
        score: Math.min(Math.round(raw), 50),
        posts,
        followers
    };
};

// ─── Main Score Calculator ─────────────────────────────────────────────────────

export const calculateFyncScore = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Run all sub-calculators in parallel
    const [
        hackathonResult,
        codingResult,
        projectResult,
        eventResult,
        internshipResult,
        communityResult
    ] = await Promise.all([
        calcHackathonScore(userId),
        calcCodingScore(user),
        calcProjectScore(userId),
        calcEventScore(userId),
        calcInternshipScore(userId),
        calcCommunityScore(user)
    ]);

    const githubResult = calcGitHubScore(user);

    const totalScore = Math.min(
        hackathonResult.score +
        codingResult.score +
        githubResult.score +
        projectResult.score +
        eventResult.score +
        internshipResult.score +
        communityResult.score,
        1000
    );

    const badge = getBadge(totalScore);

    // Upsert FyncScore document
    const scoreDoc = await FyncScore.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                totalScore,
                badge,
                "breakdown.hackathon.score":       hackathonResult.score,
                "breakdown.hackathon.participated": hackathonResult.participated,
                "breakdown.hackathon.won":          hackathonResult.won,
                "breakdown.hackathon.submitted":    hackathonResult.submitted,

                "breakdown.coding.score":           codingResult.score,
                "breakdown.coding.leetcodeSolved":  codingResult.leetcodeSolved,
                "breakdown.coding.gfgSolved":       codingResult.gfgSolved,
                "breakdown.coding.oneVsOneWins":    codingResult.oneVsOneWins,

                "breakdown.github.score":           githubResult.score,
                "breakdown.github.totalCommits":    githubResult.totalCommits,
                "breakdown.github.totalRepos":      githubResult.totalRepos,
                "breakdown.github.totalStars":      githubResult.totalStars,
                "breakdown.github.streak":          githubResult.streak,

                "breakdown.projects.score":         projectResult.score,
                "breakdown.projects.count":         projectResult.count,
                "breakdown.projects.totalLikes":    projectResult.totalLikes,

                "breakdown.events.score":           eventResult.score,
                "breakdown.events.attended":        eventResult.attended,
                "breakdown.events.asSpeaker":       eventResult.asSpeaker,

                "breakdown.internship.score":       internshipResult.score,
                "breakdown.internship.count":       internshipResult.count,
                "breakdown.internship.totalMonths": internshipResult.totalMonths,

                "breakdown.community.score":        communityResult.score,
                "breakdown.community.posts":        communityResult.posts,
                "breakdown.community.followers":    communityResult.followers,

                lastCalculated: new Date()
            },
            $push: {
                scoreHistory: {
                    $each: [{ score: totalScore, badge, recordedAt: new Date() }],
                    $slice: -30  // keep last 30 snapshots
                }
            }
        },
        { upsert: true, new: true }
    );

    // Cache on User document for fast profile reads
    await User.findByIdAndUpdate(userId, { fyncScore: totalScore, fyncBadge: badge });

    return scoreDoc;
};
