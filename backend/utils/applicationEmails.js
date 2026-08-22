/**
 * Emails sent when a recruiter decides on an application.
 *
 * Kept apart from the controller because these are the only messages a student
 * gets from a company through Fync, and their wording matters more than the
 * code around them — a rejection that reads like a system error is worse than
 * no email at all.
 */
import { sendGeneralEmail } from "./mailer.js";

const shell = (accent, body) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F5F2EC;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:2px solid #12100E;border-radius:16px;overflow:hidden">
    <div style="background:#12100E;padding:18px 22px">
      <div style="color:${accent};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700">Fync</div>
    </div>
    <div style="padding:24px 22px;color:#12100E;font-size:15px;line-height:1.6">${body}</div>
    <div style="padding:14px 22px;border-top:1px solid #E3DDD3;color:#57534E;font-size:12px">
      Sent through Fync on behalf of the company. Reply to this email to reach them directly.
    </div>
  </div>
</div>`;

export const sendShortlistedEmail = async ({ email, name, role, company }) => {
  if (!email) return;
  const first = String(name ?? "there").split(" ")[0];
  await sendGeneralEmail(
    email,
    `You've been shortlisted for ${role}`,
    shell("#F97316", `
      <p style="margin:0 0 14px">Hi ${first},</p>
      <p style="margin:0 0 14px">
        Good news — <strong>${company}</strong> has shortlisted you for
        <strong>${role}</strong>.
      </p>
      <p style="margin:0 0 14px">
        They'll be in touch about next steps. Keep an eye on this inbox and on
        your Fync notifications.
      </p>
      <p style="margin:0">Well done.</p>
    `),
  );
};

export const sendRejectedEmail = async ({ email, name, role, company }) => {
  if (!email) return;
  const first = String(name ?? "there").split(" ")[0];
  await sendGeneralEmail(
    email,
    `Update on your application for ${role}`,
    shell("#C4BEB6", `
      <p style="margin:0 0 14px">Hi ${first},</p>
      <p style="margin:0 0 14px">
        Thanks for applying to <strong>${role}</strong> at <strong>${company}</strong>.
        After reviewing your application they've decided not to move forward this time.
      </p>
      <p style="margin:0 0 14px">
        This says far less about your work than it does about how few places
        there were. Your profile stays live on Fync, and other companies are
        hiring right now.
      </p>
      <p style="margin:0">Good luck with the next one.</p>
    `),
  );
};

/**
 * A recruiter's own message to a group of candidates.
 *
 * Their words are placed inside the same shell as the automatic mails so the
 * student sees one consistent sender, and the role is stated in the header
 * because a candidate may have applied to several things.
 */
export const sendBulkCandidateEmail = async ({ email, name, role, company, subject, message }) => {
  if (!email) return;
  const first = String(name ?? "there").split(" ")[0];
  const safe = String(message)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  await sendGeneralEmail(
    email,
    subject,
    shell("#F97316", `
      <p style="margin:0 0 14px">Hi ${first},</p>
      ${safe}
      <p style="margin:18px 0 0;color:#57534E;font-size:13px">
        — ${company}, regarding <strong>${role}</strong>
      </p>
    `),
  );
};
