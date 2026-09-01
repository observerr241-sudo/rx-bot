import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzePrescription } from '../lib/gemini';
import { formatPrescriptionMessage } from '../lib/format';
import { getSupabase } from '../lib/supabase';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;

async function sendTelegramMessage(chatId: number, text: string, replyToMessageId?: number) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_to_message_id: replyToMessageId,
    }),
  });
}

async function sendChatAction(chatId: number, action: string = 'typing') {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

async function downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is missing');
  
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = (await fileRes.json()) as any;
  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  const filePath = fileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const downloadRes = await fetch(downloadUrl);
  const arrayBuffer = await downloadRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  return { buffer, mimeType };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Rx Bot Webhook is running');
  }

  if (SECRET_TOKEN && req.headers['x-telegram-bot-api-secret-token'] && req.headers['x-telegram-bot-api-secret-token'] !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(200).json({ ok: true });
    }
  }

  const message = body?.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat?.id;
  const userId = message.from?.id || chatId;
  const messageId = message.message_id;

  if (!chatId) {
    return res.status(200).json({ ok: true });
  }

  try {
    if (message.text && message.text.startsWith('/start')) {
      await sendTelegramMessage(
        chatId,
        `👋 *Welcome to Rx Prescription Bot!*\n\nSend or forward a clear photo of any doctor's prescription. I will extract the medications and explain what each one is for.`,
        messageId
      );
      return res.status(200).json({ ok: true });
    }

    let fileId: string | null = null;
    if (message.photo && message.photo.length > 0) {
      const bestPhoto = message.photo[message.photo.length - 1];
      fileId = bestPhoto.file_id;
    } else if (message.document && message.document.mime_type?.startsWith('image/')) {
      fileId = message.document.file_id;
    }

    if (!fileId) {
      if (message.text) {
        await sendTelegramMessage(
          chatId,
          `📸 Please send a clear photo of a prescription to get an analysis.`,
          messageId
        );
      }
      return res.status(200).json({ ok: true });
    }

    await sendChatAction(chatId, 'upload_photo');

    const { buffer, mimeType } = await downloadTelegramFile(fileId);
    const analysis = await analyzePrescription(buffer, mimeType);
    const formattedText = formatPrescriptionMessage(analysis);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('prescriptions').insert({
          telegram_user_id: userId,
          telegram_chat_id: chatId,
          message_id: messageId,
          raw_data: analysis,
          summary: formattedText,
        });
      } catch (dbErr) {
        console.error('Supabase write error:', dbErr);
      }
    }

    await sendTelegramMessage(chatId, formattedText, messageId);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    await sendTelegramMessage(
      chatId,
      `❌ *Error:* Could not read the prescription. Please ensure the photo is clear and try again.`,
      messageId
    );
    return res.status(200).json({ ok: true, error: error.message });
  }
}