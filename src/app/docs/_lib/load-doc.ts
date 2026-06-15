import fs from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import { getDocEntry } from './docs-manifest';

const DOCS_ROOT = path.join(process.cwd(), 'content/docs');

export type DocHeading = {
  level: number;
  text: string;
  id: string;
};

export type LoadedDoc = {
  slug: string;
  content: string;
  title: string;
  description: string;
  headings: DocHeading[];
};

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();

  for (const line of markdown.split('\n')) {
    const match = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

    const level = match[1]!.length;
    const text = match[2]!.replace(/\*\*/g, '').replace(/`/g, '').trim();
    let id = slugifyHeading(text);

    const count = seen.get(id) ?? 0;
    if (count > 0) id = `${id}-${count}`;
    seen.set(slugifyHeading(text), count + 1);

    headings.push({ level, text, id });
  }

  return headings;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.replace(/\*\*/g, '').trim() ?? 'Untitled';
}

function extractDescription(markdown: string): string {
  const lines = markdown.split('\n');
  let pastTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!pastTitle) {
      if (/^#\s+/.test(trimmed)) pastTitle = true;
      continue;
    }
    if (!trimmed || trimmed.startsWith('#')) continue;
    return trimmed.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 200);
  }

  return '';
}

function filePathForSlug(slug: string): string {
  return path.join(DOCS_ROOT, `${slug}.md`);
}

export async function getDoc(slug: string): Promise<LoadedDoc> {
  console.log('[Docs] getDoc started', { slug });

  const entry = getDocEntry(slug);
  const filePath = filePathForSlug(slug);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const title = entry?.title ?? extractTitle(content);
    const description = entry?.description ?? extractDescription(content);
    const headings = extractHeadings(content);

    console.log('[Docs] getDoc loaded', { slug, title });

    return { slug, content, title, description, headings };
  } catch (err) {
    console.error('[Docs] getDoc failed', { slug, filePath }, err);
    notFound();
  }
}

export async function docFileExists(slug: string): Promise<boolean> {
  try {
    await fs.access(filePathForSlug(slug));
    return true;
  } catch {
    return false;
  }
}
