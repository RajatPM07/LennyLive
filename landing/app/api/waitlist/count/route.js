import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 60;

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('[LennyLive] Waitlist count error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.log('[LennyLive] Waitlist count unexpected error:', err);
    return NextResponse.json({ count: 0 });
  }
}
