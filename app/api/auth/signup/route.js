import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDB } from '@/lib/db';
import { signToken, setTokenCookie } from '@/lib/auth';

export async function POST(req) {
  try {
    await initDB();
    const { name, email, password } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    // Check if email already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0)
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name}, ${email}, ${password_hash})
      RETURNING id, name, email
    `;

    const token = signToken({ id: user.id, name: user.name, email: user.email });
    const res = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
    setTokenCookie(res, token);
    return res;

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
