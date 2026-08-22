import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        default: null
    },
    dob: {
        type: Date,
        required: function() { return this.user_access === 'user'; }
    },
    fcmTokens: {
        type: [String],
        default: []
    },
    college: {
        type: String,
        required: function() { return this.user_access === 'user'; },
        index: true
    },
    year: {
        type: Number,
        required: function() { return this.user_access === 'user'; }
    },
    major: {
        type: String,
        required: function() { return this.user_access === 'user'; }
    },
    gender: {
        type: String,
        required: function() { return this.user_access === 'user' || this.user_access === 'alumni'; },
        enum: ['Male', 'Female', 'Other']
    },
    avatar: {
        type: String,
        default: 'https://cdn-icons-png.freepik.com/512/219/219988.png'
    },
    banner: {
        type: String,
        default: 'https://cdn.pixabay.com/photo/2015/10/29/14/38/web-1012467_1280.jpg'
    },
    is_subscribed: {
        type: Boolean,
        default: false
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    linkedIn_id: {
        type: String,
        sparse: true
    },
    github_id: {
        type: String,
        sparse: true
    },
    interest: {
        type: [String]
    },
    hobbies: {
        type: [String]
    },
    user_access: {
        type: String,
        enum: ['admin', 'user', 'alumni', 'recruiter'],
        default: 'user'
    },
    about: {
        type: String,
    },
    // Alumni specific fields
    graduationYear: {
        type: Number,
        index: true
    },
    company: {
        type: String,
    },
    role: {
        type: String,
    },
    experienceLevel: {
        type: String,
        enum: ['Junior', 'Mid', 'Senior', 'Lead', 'Founder', 'Other']
    },
    domains: {
        type: [String]
    },
    professionalEmail: {
        type: String,
        sparse: true
    },
    linkedIn: {
        type: String,
        default: null
    },
    isVerifiedAlumni: {
        type: Boolean,
        default: false
    },
    skills: {
        type: [String]
    },
    experience: {
        type: String
    },
    codingProfiles: {
        leetcode: {
            type: String,
            default: null
        },
        gfg: {
            type: String,
            default: null
        },
        codechef: {
            type: String,
            default: null
        },
        codeforces: {
            type: String,
            default: null
        },
        hackerrank: {
            type: String,
            default: null
        }
    },
    // Recruiter specific fields
    companyWebsite: {
        type: String,
        default: null
    },
    industry: {
        type: String,
        default: null
    },
    companySize: {
        type: String,
        default: null
    },
    codingStats: {
        totalSolved: {
            type: Number,
            default: 0
        },
        leetcodeSolved: {
            type: Number,
            default: 0
        },
        leetcodeRating: {
            type: Number,
            default: 0
        },
        gfgSolved: {
            type: Number,
            default: 0
        },
        gfgRating: {
            type: Number,
            default: 0
        },
        codechefSolved: {
            type: Number,
            default: 0
        },
        codechefRating: {
            type: Number,
            default: 0
        },
        codeforcesSolved: {
            type: Number,
            default: 0
        },
        codeforcesRating: {
            type: Number,
            default: 0
        },
        hackerrankSolved: {
            type: Number,
            default: 0
        },
        hackerrankRating: {
            type: Number,
            default: 0
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        // Snapshot of totalSolved at the last streak check. The platforms report
        // cumulative totals and never "what you did today", so without a
        // previous value to compare against there is no way to tell that a
        // student solved something — every sync would look like activity.
        lastStreakCount: {
            type: Number,
            default: null
        }
    },
    weeklyStats: {
        startOfWeekScore: {
            type: Number,
            default: 0
        },
        questionsThisWeek: {
            type: Number,
            default: 0
        }
    },
    upiId: {
        type: String,
        default: null
    },

    // ─── Education History ────────────────────────────────────────────────
    education: [
        {
            institution: { type: String, required: true },
            degree:      { type: String },          // e.g. B.Tech, 12th, 10th
            field:       { type: String },          // e.g. Computer Science
            grade:       { type: String },          // e.g. 9.1 CGPA, 92%
            startYear:   { type: Number },
            endYear:     { type: Number },
            isCurrent:   { type: Boolean, default: false },
            description: { type: String }
        }
    ],
    deviceId: {
        type: String,
        default: null
    },
    deviceModel: {
        type: String,
        default: null
    },
    location: {
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        }
    },
    oneVsOnePoints: {
        type: Number,
        default: 0
    },
    coins:{
        type: Number,
        default: 0
    },
    redeemedItems: [
        {
            item: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "MarketPlace"
            },
            product_name: String,
            coins_required: Number,
            address: String,
            pincode: String,
            mobileNumber: String,
            isProcessed: { type: Boolean, default: false },
            redeemDate: { type: Date, default: Date.now }
        }
    ],
    expoPushToken: {
        type: String,
        default: null
    },

    // ─── Fync Profile Builder ────────────────────────────────────────────
    profileBuilderCompleted: {
        type: Boolean,
        default: false
    },
    portfolioVisibility: {
        type: String,
        enum: ['public', 'fync-only', 'private'],
        default: 'public'
    },

    // GitHub OAuth
    githubUsername: {
        type: String,
        default: null,
        sparse: true
    },
    githubAccessToken: {
        type: String,         // encrypted, never exposed to client
        default: null,
        select: false
    },
    githubStats: {
        totalCommits: { type: Number, default: 0 },
        totalRepos:   { type: Number, default: 0 },
        totalStars:   { type: Number, default: 0 },
        topLanguages: { type: [String], default: [] },
        contributionStreak: { type: Number, default: 0 },
        avatarUrl:    { type: String, default: null },
        bio:          { type: String, default: null },
        lastFetched:  { type: Date,   default: null }
    },

    // Fync Score (cached from FyncScore collection for quick reads)
    fyncScore: {
        type: Number,
        default: 0
    },
    fyncBadge: {
        type: String,
        enum: ['Newcomer', 'Explorer', 'Builder', 'Innovator', 'Pioneer', 'Legend'],
        default: 'Newcomer'
    },
    // Coding Arena Stats
    codingRating: {
        type: Number,
        default: 1200
    },
    contestHistory: [
        {
            contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
            rank: Number,
            ratingChange: Number,
            date: { type: Date, default: Date.now }
        }
    ],
    resumeUrl: {
        type: String,
        default: null
    },
    resumeName: {
        type: String,
        default: null
    },
    streakCount: {
        type: Number,
        default: 0
    },
    highestStreak: {
        type: Number,
        default: 0
    },
    lastPostDate: {
        type: Date,
        default: null
    },
    // Shadow Rival lives on the user rather than the pair document because it has
    // to survive the pair being dissolved — that is the whole point of an opt-out
    // and of a per-season rematch budget.
    shadowRival: {
        optOut: { type: Boolean, default: false },
        // Which season `rematchesUsed` and `avoid` belong to. A different value
        // means both are stale and reset on read.
        season: { type: String, default: "" },
        rematchesUsed: { type: Number, default: 0 },
        // Rivals already had this season. Prevents a rematch from handing back
        // the same person, and stops the nightly pairing undoing it.
        avoid: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    },
    isBanned: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Performance Indexes for Industry-Grade Speed
userSchema.index({ name: 'text', username: 'text' }); // Fast Search
userSchema.index({ fyncScore: -1 });                 // Leaderboard speed
userSchema.index({ codingRating: -1 });              // Arena Leaderboard
userSchema.index({ college: 1, user_access: 1 });    // Campus filtering
userSchema.index({ createdAt: -1 });                 // New user sorting
// Campus Legends. Without this the leaderboard sorted the entire users
// collection in memory, which past ~32MB of matching documents does not just
// get slow -- Mongo aborts the query outright.
userSchema.index({ streakCount: -1, updatedAt: 1 });
// 1v1 quiz leaderboard, same shape.
userSchema.index({ oneVsOnePoints: -1 });
// Campus Alumni: filter by college + role, newest first. The existing
// { college, user_access } index stopped short of the sort key, so every page
// still sorted in memory.
userSchema.index({ college: 1, user_access: 1, createdAt: -1 });

// The auth middleware caches a projection of this document in Redis. Invalidate
// here rather than at each of the ~30 call sites that mutate a user, so a ban or
// a profile edit can never be served stale.
const dropAuthCache = async (id) => {
    if (!id) return;
    try {
        const { default: redisClient } = await import('../utils/redis.js');
        await redisClient.del(`auth:user:${String(id)}`);
    } catch (err) {
        console.error('Auth cache invalidation error:', err.message);
    }
};

userSchema.post('save', function (doc) { dropAuthCache(doc?._id); });
userSchema.post(/^findOneAnd/, function (doc) { dropAuthCache(doc?._id); });
userSchema.post(['updateOne', 'updateMany'], async function () {
    const id = this.getFilter?.()?._id;
    if (id) await dropAuthCache(id);
});

const User = mongoose.model('User', userSchema);
export default User;