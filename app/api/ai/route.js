import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUser } from '@/lib/auth';
import { GoogleGenerativeAI } from "@google/generative-ai";

function stripHtml(h) {
  return (h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export async function POST(req) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question, currentEntryKey } = await req.json();
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

  const entries = await sql`
    SELECT entry_key, html, updated_at
    FROM entries
    WHERE user_id = ${user.id}
    ORDER BY entry_key DESC
    LIMIT 30
  `;

  const journalContext = entries
    .map(e => {
      const text = stripHtml(e.html);
      return text ? `[${e.entry_key}]\n${text}` : null;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');

  const currentEntryText = currentEntryKey
    ? stripHtml(entries.find(e => e.entry_key === currentEntryKey)?.html || '')
    : null;

  const systemPrompt = `You are a warm, emotionally intelligent journaling companion for ${user.name}.
Tone: Warm, human, 2-4 sentences max.

${journalContext ? `Journal Context:\n${journalContext}` : 'No entries yet.'}
${currentEntryText ? `Current Entry:\n${currentEntryText}` : ''}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use 1.5-flash which is the fastest and usually the default
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(`${systemPrompt}\n\nQuestion: ${question}`);
    const response = await result.response;
    const reply = response.text();

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Gemini SDK error:', err);
    return NextResponse.json({ 
      error: `Gemini SDK Error: ${err.message || 'Unknown error'}`,
      suggestion: "If this says 'model not found', your API key might only have access to 'gemini-pro'."
    }, { status: 500 });
  }
}
