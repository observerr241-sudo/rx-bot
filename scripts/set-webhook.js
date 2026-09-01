require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
const vercelUrl = process.env.VERCEL_URL;

if (!token || !vercelUrl) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN or VERCEL_URL in environment');
  process.exit(1);
}

const cleanUrl = vercelUrl.replace(/\/$/, '');
const webhookUrl = `${cleanUrl}/api/webhook`;

async function setWebhook() {
  const payload = {
    url: webhookUrl,
    allowed_updates: ['message'],
  };
  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log('Set Webhook Result:', data);
}

setWebhook();
