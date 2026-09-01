require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN in environment');
  process.exit(1);
}

async function deleteWebhook() {
  const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
  });

  const data = await response.json();
  console.log('Delete Webhook Result:', data);
}

deleteWebhook();
