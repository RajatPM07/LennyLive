import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const raw = body?.email;

    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ status: 'error', message: 'Email is required.' }, { status: 400 });
    }

    const email = raw.trim().toLowerCase();

    if (!email || email.length > 320 || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ status: 'error', message: 'Please enter a valid email address.' }, { status: 400 });
    }

    const { error } = await supabase.from('waitlist').insert({ email });

    if (error) {
      // Unique constraint violation — already on the waitlist
      if (error.code === '23505') {
        return NextResponse.json({ status: 'duplicate' });
      }
      console.log('[LennyLive] Waitlist insert error:', error);
      return NextResponse.json(
        { status: 'error', message: 'Something went wrong. Try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'success' });
  } catch (err) {
    console.log('[LennyLive] Waitlist POST unexpected error:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong. Try again in a moment.' },
      { status: 500 }
    );
  }
}
