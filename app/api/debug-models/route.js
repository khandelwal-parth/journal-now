import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API Key found' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // There isn't a direct "listModels" in the basic SDK, so we'll try a manual fetch 
    // to the models endpoint using the key to see what Google says.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    
    return NextResponse.json({ 
      message: "Here are the models your key can see:",
      models: data.models?.map(m => m.name) || [],
      raw: data
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
