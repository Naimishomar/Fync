import mongoose from "mongoose";

/**
 * Fync lists hackathons; it does not run them.
 *
 * Every host has their own registration stack — Devfolio, Unstop, a Google
 * Form, their own site — so the platform stores the listing and hands the
 * student off to `applyLink`. The only thing that comes back is the winner
 * list the host tags once it is over.
 */
const hackathonSchema = new mongoose.Schema({
   hackathonId: {
      type: String,
      unique: true,
      required: true
   },
   title: {
      type: String,
      required: true
   },
   organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
   },
   // Where the "Apply" button sends the student. The host owns everything
   // past this point.
   applyLink: {
      type: String,
      required: true,
      trim: true
   },
   applyLabel: {
      type: String,
      default: "Register",
      trim: true
   },
   // Shown for context only — Fync never gates on these, the host's own form
   // decides who gets in.
   registrationstart: Date,
   registrationends: Date,
   hackathonstarts: {
      type: Date,
      required: true
   },
   hackathonends: {
      type: Date,
      required: true
   },
   mode: {
      type: String,
      enum: ["Online", "Offline", "Hybrid"],
      default: "Online"
   },
   location: {
      type: String,
      default: ""
   },
   teamSize: {
      type: String,
      default: ""
   },
   prizepool: {
      type: String,
   },
   prizes: [{
      rank: Number,
      title: String,
      amount: String
   }],
   eligibility: {
      colleges: [String],
      Year: [String],
      branch: [String]
   },
   // Tagged by the organiser after the hackathon ends. `users` are Fync
   // accounts, so a win shows up on the student's profile; `teamName` covers
   // teammates who are not on Fync.
   winners: [
      {
         rank: Number,
         title: String,
         amount: String,
         teamName: String,
         users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
         projectLink: String,
         note: String,
         wonAt: { type: Date, default: Date.now }
      }
   ],
   createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
   },
   tags: {
      type: [{ type: String }]
   },
   /**
    * Visibility only — NOT the lifecycle.
    *
    * Whether a hackathon is upcoming, live or over is decided by
    * `hackathonstarts`/`hackathonends`, computed per request. It used to be
    * stored here and flipped by hand, which meant every listing sat on
    * whatever the organiser last set, so the Live filter matched nothing.
    *
    * "upcoming" / "active" / "completed" survive in the enum because existing
    * documents hold them; anything that is not "draft" counts as published.
    */
   status: {
      type: String,
      enum: ["draft", "published", "upcoming", "active", "completed"],
      default: "published"
   },
   description: {
      type: String,
      default: ""
   },
   rules: [{
      type: String
   }],
   faqs: [{
      question: String,
      answer: String
   }],
   tracks: [{
      title: String,
      description: String,
      prizes: String
   }],
   timeline: [{
      label: String,
      date: Date,
      description: String
   }],
   aboutTheOrganiser: {
      type: String,
      default: ""
   },
   contactEmail: String,
   discordLink: String,
   websiteLink: String,
   prizePoolCurrency: {
      type: String,
      default: "INR"
   },
   sponsors: [
      { 
         name: String, 
         logo: String, 
         level: { 
            type: String, 
            enum: ["Title", "Platinum", "Gold", "Silver", "Bronze", "Partner"],
            default: "Partner"
         } 
      }
   ],
   logo: { type: String },
   bannerImage: { type: String },
},
   {
      timestamps: true
   })

hackathonSchema.index({ status: 1, tags: 1 });
// getMyHackathons (organised + won), list sort by recency
hackathonSchema.index({ organiser: 1 });
hackathonSchema.index({ status: 1, createdAt: -1 });
// The live/upcoming/ended filters are date range scans, and every one of them
// sorts by a date. Without these each filter reads the whole collection.
hackathonSchema.index({ status: 1, hackathonstarts: 1 });
hackathonSchema.index({ status: 1, hackathonends: 1 });
// "hackathons this student has won" — the profile/score lookup
hackathonSchema.index({ "winners.users": 1 });
const Hackathon = mongoose.model("Hackathon", hackathonSchema);
export default Hackathon;
