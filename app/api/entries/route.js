import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUser } from '@/lib/auth';

// GET all entries for logged in user
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await sql`
    SELECT entry_key, html, created_at, updated_at
    FROM entries
    WHERE user_id = ${user.id}
    ORDER BY entry_key DESC
  `;

  // Convert to object keyed by entry_key (matches old localStorage format)
  const result = {};
  for (const e of entries) {
    result[e.entry_key] = {
      html: e.html,
      created: e.created_at,
      updated: e.updated_at,
    };
  }

  return NextResponse.json(result);
}

// POST — save/update a single entry
export async function POST(req) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entry_key, html } = await req.json();
  if (!entry_key) return NextResponse.json({ error: 'entry_key required' }, { status: 400 });

  await sql`
    INSERT INTO entries (user_id, entry_key, html, updated_at)
    VALUES (${user.id}, ${entry_key}, ${html}, NOW())
    ON CONFLICT (user_id, entry_key)
    DO UPDATE SET html = ${html}, updated_at = NOW()
  `;

  return NextResponse.json({ success: true });
}

// DELETE a single entry
export async function DELETE(req) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entry_key } = await req.json();
  if (!entry_key) return NextResponse.json({ error: 'entry_key required' }, { status: 400 });

  await sql`
    DELETE FROM entries WHERE user_id = ${user.id} AND entry_key = ${entry_key}
  `;

  return NextResponse.json({ success: true });
}
