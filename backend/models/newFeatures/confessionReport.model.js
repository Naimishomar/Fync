import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    confessionId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Confession",
        required: true
    },
    reporterId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
}, {timestamps: true});

const ConfessionReport = mongoose.model("ConfessionReport", reportSchema);
export default ConfessionReport;