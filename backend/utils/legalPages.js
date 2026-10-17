// Public pages linked from the Play Store listing: GET /privacy, GET /delete-account.
// Plain strings, no template engine. Edit the text here.
const SUPPORT_EMAIL = 'fync.dev@gmail.com'; // same address as the in-app T&C
const UPDATED = '2026-10-18';

const page = (title, body) => `<!doctype html>
<!-- DRAFT: written from what the code collects as of ${UPDATED}. The owner must review it (legal entity name, jurisdiction, retention periods) before relying on it. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Fync</title>
<style>
:root{--paper:#F5F2EC;--ink:#12100E;--ink2:#4a4540;--brand:#EA580C;--line:#e3ddd3}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:28px;line-height:1.2;margin:0 0 4px}
h1 span{color:var(--brand)}
h2{font-size:19px;margin:32px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
p,li{color:var(--ink2)}
ul,ol{padding-left:20px}
a{color:var(--brand)}
.meta{font-size:14px;color:var(--ink2);margin:0 0 24px}
.box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
</style></head><body><main>
<h1>Fync<span>.</span> ${title}</h1>
<p class="meta">Last updated ${UPDATED}</p>
${body}
</main></body></html>`;

export const privacyPage = page('Privacy Policy', `
<p>Fync is a social and career app for college students, alumni and recruiters. This policy explains what we collect, why, who we share it with, and how to delete it. Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

<h2>What we collect</h2>
<ul>
<li><strong>Account data</strong>: name, username, email, mobile number, password (stored only as a hash), date of birth, gender, college, year and major. Alumni and recruiters also give company, role, experience level, work email, company website, industry, company size and LinkedIn link.</li>
<li><strong>Profile data you choose to add</strong>: photo, banner, bio, skills, interests, hobbies, education, projects, internships, certificates, resume, coding-platform usernames (LeetCode, GeeksforGeeks, CodeChef, Codeforces, HackerRank) and, if you connect it, your GitHub username and public GitHub statistics.</li>
<li><strong>Content</strong>: posts, Shorts (videos), comments, chats and group messages, images and files you upload, notes, marketplace and lost-and-found listings, and quiz, contest and game results.</li>
<li><strong>Voice</strong>: when you use AI mock interviews, your recorded answers are uploaded and transcribed to text.</li>
<li><strong>Device data</strong>: a device identifier and model name (used to keep a student account on one device), push-notification tokens, and crash reports (Firebase Crashlytics) containing device type, OS version and the app state at the time of the crash.</li>
<li><strong>Payments</strong>: when you buy a subscription or service, payment is handled by Razorpay. We receive the order and payment IDs and the amount. We never see or store your card, UPI PIN or bank details.</li>
<li><strong>Marketplace redemptions</strong>: if you redeem coins for an item, the delivery address, pincode and phone number you enter.</li>
</ul>
<p>We do not use advertising or analytics SDKs, and we do not collect your GPS location. A post can carry a location only if you type one in.</p>

<h2>Permissions the app asks for</h2>
<ul>
<li><strong>Camera</strong>: to take photos for posts, chats and your profile, and for video calls.</li>
<li><strong>Microphone</strong>: for audio and video calls and for recording interview answers.</li>
<li><strong>Photos and videos</strong>: to pick images and videos to post, and to save converted PDF pages to your gallery.</li>
<li><strong>Notifications</strong>: to tell you about messages, follows and activity.</li>
</ul>
<p>Each permission is asked for only when you use the feature, and can be turned off in your phone settings.</p>

<h2>How we use it</h2>
<ul>
<li>To run your account, show your profile and content to other users, and connect you with classmates, alumni and recruiters.</li>
<li>To send one-time passcodes, notifications and service emails.</li>
<li>To power AI features (mock interviews, placement predictions and similar tools).</li>
<li>To process payments, prevent abuse, enforce our terms and fix crashes.</li>
</ul>

<h2>What other people can see</h2>
<p>Your name, username, photo, college, bio, skills, posts, Shorts, followers and the portfolio items you mark public are visible to other Fync users. Your email, phone number, date of birth, device data and payment details are not shown to other users.</p>

<h2>Who we share it with</h2>
<p>We do not sell your data. We use these service providers to run Fync, and they process data only for that purpose:</p>
<ul>
<li>Amazon Web Services (servers, India) and MongoDB Atlas (database)</li>
<li>Cloudflare R2 (stored images, videos, audio and files)</li>
<li>Supabase (chat messages)</li>
<li>Google Firebase (push notifications and crash reports) and Expo (push notifications)</li>
<li>Razorpay (payments)</li>
<li>Groq and Google Gemini (transcribing interview audio and generating AI responses)</li>
<li>Google Gmail (sending verification emails)</li>
<li>GitHub (only if you connect your account)</li>
</ul>
<p>We may disclose data if the law requires it.</p>

<h2>How long we keep it</h2>
<p>We keep your account and content until you delete them or delete your account. Some spaces are temporary by design and are cleared automatically (for example college chat and night chat rooms). One-time passcodes expire after 5 minutes. Payment records may be kept as long as tax and accounting law requires.</p>

<h2>Deleting your data</h2>
<p>You can delete your account in the app under <strong>Settings → Delete account</strong>, or by emailing us. See <a href="/delete-account">how to delete your account</a> for what is removed.</p>

<h2>Security</h2>
<p>Data travels over HTTPS. Passwords are hashed and never stored in plain text. No system is perfectly secure; tell us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> if you find a problem.</p>

<h2>Children</h2>
<p>Fync is for people aged 13 and over. We do not knowingly collect data from children under 13. If you believe a child under 13 has an account, email us and we will delete it.</p>

<h2>Changes</h2>
<p>If we change this policy we will update the date above, and tell you in the app for significant changes.</p>

<h2>Contact</h2>
<p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
`);

export const deleteAccountPage = page('Delete your account', `
<p>You can delete your Fync account and its data at any time.</p>

<div class="box">
<h2 style="border:0;margin-top:0;padding-top:0">In the app</h2>
<ol>
<li>Open Fync and sign in.</li>
<li>Go to <strong>Settings → Delete account</strong>.</li>
<li>Confirm. Your account is deleted immediately and you are signed out.</li>
</ol>
</div>

<div class="box">
<h2 style="border:0;margin-top:0;padding-top:0">By email</h2>
<p>If you cannot open the app, email <a href="mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Fync%20account">${SUPPORT_EMAIL}</a> from the address registered on your account, with the subject "Delete my Fync account" and your username. We will confirm and delete it within 30 days.</p>
</div>

<h2>What is deleted</h2>
<ul>
<li>Your profile and account details (name, email, phone, date of birth, college and the rest)</li>
<li>Your posts, Shorts, comments and notifications</li>
<li>Reports you filed and reports about your content</li>
<li>Your profile photo, banner and resume files</li>
<li>You are removed from other users' followers and following lists</li>
</ul>

<h2>What may remain</h2>
<ul>
<li>Messages you sent in chats and group rooms may stay visible to the people who received them. Email us to have them removed.</li>
<li>Other items you created, such as portfolio projects, certificates, notes, marketplace or lost-and-found listings and community posts, are not yet removed automatically. Email us and we will delete them.</li>
<li>Payment records, which we may have to keep for tax and accounting law.</li>
</ul>

<p>Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Read the <a href="/privacy">privacy policy</a>.</p>
`);
