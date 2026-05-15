import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUser } from '@/lib/auth';

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
  
Tone: Warm, gentle, human. 2-4 sentences max. No lists.

${journalContext ? `Journal Context:\n${journalContext}` : 'No entries yet.'}
${currentEntryText ? `Current Entry:\n${currentEntryText}` : ''}`;

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing in Vercel' }, { status: 500 });
  }

  // List of model IDs to try in order of preference
  const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY 
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nQuestion: ${question}` }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return NextResponse.json({ reply });
      } else {
        const err = await response.json().catch(() => ({}));
        lastError = err.error?.message || response.statusText;
        console.warn(`Model ${model} failed:`, lastError);
        // Continue to next model
      }
    } catch (err) {
      lastError = err.message;
      console.error(`Fetch error for ${model}:`, err);
    }
  }

  return NextResponse.json({ error: `Gemini failed after trying multiple models. Last error: ${lastError}` }, { status: 500 });
}
