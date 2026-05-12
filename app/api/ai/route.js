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

  // Fetch all entries for context
  const entries = await sql`
    SELECT entry_key, html, updated_at
    FROM entries
    WHERE user_id = ${user.id}
    ORDER BY entry_key DESC
    LIMIT 30
  `;

  // Build readable journal context
  const journalContext = entries
    .map(e => {
      const text = stripHtml(e.html);
      if (!text) return null;
      return `[${e.entry_key}]\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');

  const currentEntryText = currentEntryKey
    ? stripHtml(entries.find(e => e.entry_key === currentEntryKey)?.html || '')
    : null;

  const systemPrompt = `You are a warm, emotionally intelligent journaling companion for ${user.name}. You have read access to their private journal entries and your job is to help them reflect, understand themselves, and feel heard.

Tone rules:
- Be warm, gentle, and human — never clinical or robotic
- Be concise but meaningful — 2–4 sentences usually, never a wall of text
- Never bullet points or lists — always flowing, conversational prose
- If they ask about their writing/mood/patterns, reference specific entries naturally
- If they ask something general (advice, a question about life), answer warmly but optionally tie it back to what we've written
- Never say "based on your journal entries" — just speak as if you know them naturally
- Use "you" not "one" — keep it personal

${journalContext
  ? `Here are ${user.name}'s journal entries (most recent first):\n\n${journalContext}`
  : `${user.name} hasn't written any journal entries yet.`}

${currentEntryText ? `They are currently looking at this entry:\n${currentEntryText}` : ''}`;

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${question}` }]
      }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7,
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini API error:', errorData);
    return NextResponse.json({ error: 'Failed to fetch response from Gemini' }, { status: response.status });
  }

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Something went wrong, try again.';
  return NextResponse.json({ reply });
}
