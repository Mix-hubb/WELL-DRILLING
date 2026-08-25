import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
  return client!;
}

export async function sendResetCodeSms(phone: string, code: string): Promise<void> {
  const c = getClient();
  if (!c || !fromNumber) {
    throw new Error("SMS service not configured");
  }

  await c.messages.create({
    body: `[Well-Drilling] รหัสยืนยันของคุณคือ ${code} (หมดอายุใน 10 นาที)`,
    from: fromNumber,
    to: phone,
  });
}
