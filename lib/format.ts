import { PrescriptionAnalysis } from './gemini';

export function formatPrescriptionMessage(analysis: PrescriptionAnalysis): string {
  let text = `📋 *Prescription Analysis*\n\n`;

  if (!analysis.medicines || analysis.medicines.length === 0) {
    text += `⚠️ *No clear medicines identified.*\nPlease ensure the image is well-lit and legible.\n\n`;
  } else {
    analysis.medicines.forEach((med, i) => {
      text += `*${i + 1}. ${med.brand_name}*`;
      if (med.generic_name && med.generic_name !== med.brand_name) {
        text += ` (${med.generic_name})`;
      }
      text += `\n`;
      text += `💊 *Purpose:* ${med.purpose}\n`;
      if (med.dosage) text += `📏 *Dosage:* ${med.dosage}\n`;
      if (med.frequency) text += `⏰ *Frequency:* ${med.frequency}\n`;
      if (med.instructions) text += `📌 *Instructions:* ${med.instructions}\n`;
      if (med.confidence !== 'high' || med.handwriting_note) {
        text += `⚠️ *Note:* ${med.handwriting_note || 'Handwriting unclear, verify with pharmacist.'}\n`;
      }
      text += `\n`;
    });
  }

  if (analysis.doctor_advice) {
    text += `🩺 *Doctor's Advice / Notes:*\n${analysis.doctor_advice}\n\n`;
  }

  text += `⚠️ _${analysis.disclaimer}_`;

  return text;
}
