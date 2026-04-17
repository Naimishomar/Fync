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
        required: true
    },
    college: {
        type: String,
        required: true,
        index: true
    },
    year: {
        type: Number,
        required: true
    },
    major: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female']
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
        enum: ['admin', 'user', 'alumni'],
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
        }
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
        lastUpdated: {
            type: Date,
            default: Date.now
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
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;