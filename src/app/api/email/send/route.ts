import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail, sendCertificationEmail } from '~/lib/email';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/**
 * API route for sending emails
 * This can be called from database triggers or server actions
 * 
 * POST /api/email/send
 * Body: {
 *   type: 'welcome' | 'certification',
 *   email: string,
 *   userId?: string, // For welcome emails, we can fetch user data
 *   // For certification emails:
 *   artworkTitle?: string,
 *   certificateNumber?: string,
 *   artworkUrl?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request has a secret key to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.EMAIL_API_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, email, userId, artworkTitle, certificateNumber, artworkUrl, name } = body;

    if (!type || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: type and email' },
        { status: 400 }
      );
    }

    // For welcome emails, fetch user data if userId is provided
    if (type === 'welcome') {
      let userName = name;
      
      if (!userName && userId) {
        try {
          const adminClient = getSupabaseServerAdminClient();
          const { data: account } = await adminClient
            .from('accounts')
            .select('name, email')
            .eq('id', userId)
            .single();
          
          if (account) {
            userName = account.name || account.email?.split('@')[0] || 'there';
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          userName = userName || 'there';
        }
      }

      await sendWelcomeEmail(email, userName || 'there');
      return NextResponse.json({ success: true, message: 'Welcome email sent' });
    }

    // For certification emails
    if (type === 'certification') {
      if (!artworkTitle || !certificateNumber || !artworkUrl) {
        return NextResponse.json(
          { error: 'Missing required fields for certification email: artworkTitle, certificateNumber, artworkUrl' },
          { status: 400 }
        );
      }

      let userName = name || 'there';
      
      if (!name && userId) {
        try {
          const adminClient = getSupabaseServerAdminClient();
          const { data: account } = await adminClient
            .from('accounts')
            .select('name')
            .eq('id', userId)
            .single();
          
          if (account?.name) {
            userName = account.name;
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }

      await sendCertificationEmail(email, userName, artworkTitle, certificateNumber, artworkUrl);
      return NextResponse.json({ success: true, message: 'Certification email sent' });
    }

    return NextResponse.json(
      { error: 'Invalid email type' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in email API route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

