import { NextRequest, NextResponse } from 'next/server';
import {
  sendWelcomeEmail,
  sendCertificationEmail,
  sendNotificationEmail,
  sendSummaryEmail,
  sendUpdateEmail,
} from '~/lib/email';
import type { SummaryItem } from '~/lib/email';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/**
 * API route for sending emails
 * This can be called from database triggers or server actions
 *
 * POST /api/email/send
 * Body: {
 *   type: 'welcome' | 'certification' | 'notification' | 'summary' | 'update',
 *   email: string,
 *   userId?: string,
 *   name?: string,
 *   // certification: artworkTitle, certificateNumber, artworkUrl
 *   // notification: subject, title, body, ctaUrl?, ctaLabel?
 *   // summary: subject, items: [{ title, description? }], period?
 *   // update: subject, title, body, link?, linkLabel?
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
    const {
      type,
      email,
      userId,
      name,
      artworkTitle,
      certificateNumber,
      artworkUrl,
      subject: subjectParam,
      title,
      body: bodyParam,
      ctaUrl,
      ctaLabel,
      items,
      period,
      link,
      linkLabel,
    } = body;

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

    // Notification emails
    if (type === 'notification') {
      if (!subjectParam || !title || bodyParam === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields for notification email: subject, title, body' },
          { status: 400 }
        );
      }
      let userName = name;
      if (userName === undefined && userId) {
        try {
          const adminClient = getSupabaseServerAdminClient();
          const { data: account } = await adminClient
            .from('accounts')
            .select('name, email')
            .eq('id', userId)
            .single();
          userName = account?.name ?? account?.email?.split('@')[0] ?? 'there';
        } catch {
          userName = 'there';
        }
      }
      await sendNotificationEmail(email, userName ?? 'there', subjectParam, {
        title,
        body: String(bodyParam),
        ctaUrl: ctaUrl ?? undefined,
        ctaLabel: ctaLabel ?? undefined,
      });
      return NextResponse.json({ success: true, message: 'Notification email sent' });
    }

    // Summary emails
    if (type === 'summary') {
      if (!subjectParam || !Array.isArray(items)) {
        return NextResponse.json(
          { error: 'Missing required fields for summary email: subject, items (array)' },
          { status: 400 }
        );
      }
      let userName = name;
      if (userName === undefined && userId) {
        try {
          const adminClient = getSupabaseServerAdminClient();
          const { data: account } = await adminClient
            .from('accounts')
            .select('name, email')
            .eq('id', userId)
            .single();
          userName = account?.name ?? account?.email?.split('@')[0] ?? 'there';
        } catch {
          userName = 'there';
        }
      }
      const summaryItems: SummaryItem[] = items.map((item: unknown) => {
        if (item && typeof item === 'object' && 'title' in item && typeof (item as { title: unknown }).title === 'string') {
          const o = item as { title: string; description?: string };
          return { title: o.title, description: typeof o.description === 'string' ? o.description : undefined };
        }
        return { title: String(item) };
      });
      await sendSummaryEmail(email, userName ?? 'there', subjectParam, summaryItems, period);
      return NextResponse.json({ success: true, message: 'Summary email sent' });
    }

    // Update emails
    if (type === 'update') {
      if (!subjectParam || !title || bodyParam === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields for update email: subject, title, body' },
          { status: 400 }
        );
      }
      let userName = name;
      if (userName === undefined && userId) {
        try {
          const adminClient = getSupabaseServerAdminClient();
          const { data: account } = await adminClient
            .from('accounts')
            .select('name, email')
            .eq('id', userId)
            .single();
          userName = account?.name ?? account?.email?.split('@')[0] ?? 'there';
        } catch {
          userName = 'there';
        }
      }
      await sendUpdateEmail(email, userName ?? 'there', subjectParam, {
        title,
        body: String(bodyParam),
        link: link ?? undefined,
        linkLabel: linkLabel ?? undefined,
      });
      return NextResponse.json({ success: true, message: 'Update email sent' });
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

