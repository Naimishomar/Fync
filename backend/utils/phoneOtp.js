import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

export const sendPhoneOTP = async (phoneNumber) => {
  return client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verifications
    .create({ to: phoneNumber, channel: "sms" });
};

export const verifyPhoneOTP = async (phoneNumber, otp) => {
  return client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verificationChecks
    .create({ to: phoneNumber, code: otp });
};
