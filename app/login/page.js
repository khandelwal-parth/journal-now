'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    window.location.href = '/';
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>📔 my journal.</div>
        <div style={styles.subtitle}>welcome back</div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="email address"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'logging in...' : '✦ log in'}
          </button>
        </form>

        <div style={styles.footer}>
          don&apos;t have an account?{' '}
          <Link href="/signup" style={styles.link}>sign up</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#faf7f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Instrument Sans', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
    border: '1px solid #e8e0d4',
  },
  brand: {
    fontFamily: "'Lora', serif",
    fontSize: 28,
    fontStyle: 'italic',
    color: '#7c5c3a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    color: '#a08c78',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: '0.06em',
  },
  error: {
    background: '#fef0ef',
    border: '1px solid #f5c0bc',
    color: '#c0392b',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '1.5px solid #e8e0d4',
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 14,
    color: '#1a1410',
    background: '#faf7f2',
    outline: 'none',
  },
  btn: {
    padding: '13px',
    background: '#7c5c3a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: '0.02em',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
    color: '#a08c78',
  },
  link: { color: '#7c5c3a', fontWeight: 600, textDecoration: 'none' },
};
