import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    tagline: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    longDescription: {
        type: String,
    },
    techStack: {
        type: [String],
        default: []
    },
    githubUrl: {
        type: String,
        default: null
    },
    liveUrl: {
        type: String,
        default: null
    },
    images: {
        type: [String],
        default: []
    },
    videoDemo: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed', 'archived'],
        default: 'completed'
    },
    startDate: {
        type: Date,
        default: null
    },
    endDate: {
        type: Date,
        default: null
    },
    collaborators: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            role: { type: String, default: "Collaborator" }
        }
    ],
    // Optional links to existing Fync entities
    hackathon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hackathon",
        default: null
    },
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    views: {
        type: Number,
        default: 0
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    tags: {
        type: [String],
        default: []
    },
    // Visibility control
    isPublic: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

projectSchema.index({ user: 1, isFeatured: -1, createdAt: -1 });

const UserProject = mongoose.model("UserProject", projectSchema);
export default UserProject;
