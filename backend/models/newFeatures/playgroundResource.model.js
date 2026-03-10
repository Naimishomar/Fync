import mongoose from "mongoose";

const playgroundResourceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    resourceName: {
        type: String,
        required: true,
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// Ensure id is easily accessible as "id" in JSON to match json-server expectations
playgroundResourceSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

playgroundResourceSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // Return only the data merged with the id
        return { id: ret.id, ...ret.data, createdAt: ret.createdAt, updatedAt: ret.updatedAt };
    }
});

const PlaygroundResource = mongoose.model("PlaygroundResource", playgroundResourceSchema);
export default PlaygroundResource;
