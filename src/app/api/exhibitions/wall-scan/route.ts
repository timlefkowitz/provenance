import { NextResponse } from 'next/server';

import { scanExhibitionWall } from '~/app/exhibitions/_actions/scan-exhibition-wall';

/**
 * Wall scan (see scanExhibitionWall). A route rather than a server action so it gets its own
 * time limit: embedding hundreds of photo windows on a function's CPU outlasts the exhibition
 * page's 60 s. The scan itself stops early (75 s budget) and returns its best matches.
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Choose or take a photo first.' }, { status: 400 });
  }
  return NextResponse.json(await scanExhibitionWall(formData));
}
