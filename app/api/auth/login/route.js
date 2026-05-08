import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { signToken, setTokenCookie } from '@/lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password)
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });

    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!user)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const token = signToken({ id: user.id, name: user.name, email: user.email });
    const res = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
    setTokenCookie(res, token);
    return res;

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
