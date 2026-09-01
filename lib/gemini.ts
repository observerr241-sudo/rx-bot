import { GoogleGenerativeAI } from '@google/generative-ai';

export interface MedicineDetail {
  brand_name: string;
  generic_name: string;
  purpose: string;
  dosage: string;
  frequency: string;
  instructions: string;
  confidence: 'high' | 'medium' | 'low';
  handwriting_note?: string;
}

export interface PrescriptionAnalysis {
  medicines: MedicineDetail[];
  doctor_advice?: string;
  disclaimer: string;
}

export async function analyzePrescription(imageBuffer: Buffer, mimeType: string): Promise<PrescriptionAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are an expert clinical pharmacist assistant. 
Analyze this prescription image and extract the list of prescribed medicines with their intended layman-friendly purpose, generic name, dosage, and instructions.

Provide the result strictly in this JSON format:
{
  "medicines": [
    {
      "brand_name": "Brand name as written",
      "generic_name": "Generic compound name",
      "purpose": "Layman friendly explanation of what this medicine does and why it was prescribed",
      "dosage": "e.g. 500mg, 1 tablet",
      "frequency": "e.g. 1+0+1, twice daily after meals",
      "instructions": "Any specific instructions or timings",
      "confidence": "high" | "medium" | "low",
      "handwriting_note": "Mention if handwriting is unclear or ambiguous"
    }
  ],
  "doctor_advice": "Any additional advice or instructions visible on the prescription (diet, rest, diagnostic tests)",
  "disclaimer": "This is an AI-assisted analysis for informational purposes only. Always consult your doctor or pharmacist before taking medications."
}`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mimeType || 'image/jpeg',
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();
  return JSON.parse(responseText) as PrescriptionAnalysis;
}