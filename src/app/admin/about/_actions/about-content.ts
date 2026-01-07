'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const ABOUT_CONTENT_PATH = path.join(process.cwd(), 'data', 'about-content.json');

export type AboutContent = {
  header: {
    title: string;
    subtitle: string;
  };
  mission: {
    title: string;
    paragraphs: string[];
  };
  whatWeProvide: {
    title: string;
    sections: Array<{
      title: string;
      content: string;
    }>;
  };
  whyItMatters: {
    title: string;
    paragraphs: string[];
  };
  founders: {
    title: string;
    founders: Array<{
      name: string;
      role: string;
      bio: string;
    }>;
  };
  callToAction: {
    title: string;
    description: string;
  };
};

/**
 * Read about page content from JSON file
 */
export async function getAboutContent(): Promise<AboutContent> {
  try {
    const fileContents = await fs.readFile(ABOUT_CONTENT_PATH, 'utf8');
    return JSON.parse(fileContents) as AboutContent;
  } catch (error) {
    // If file doesn't exist, try to create it with default content
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('About content file not found, creating default file...');
      const defaultContent: AboutContent = {
        header: {
          title: "ABOUT PROVENANCE",
          subtitle: "Empowering Artists Through Immutable Provenance"
        },
        mission: {
          title: "Our Mission",
          paragraphs: [
            "<strong>Provenance</strong> is dedicated to helping artists establish and maintain the complete history of their work. We provide a trusted platform where artists can create certificates of authentication, document ownership transfers, and track the journey of their art from creation through every sale and location.",
            "In an art world where authenticity and provenance are paramount, we believe every artist deserves the tools to protect their legacy and ensure their work's history remains accurate, verifiable, and permanent."
          ]
        },
        whatWeProvide: {
          title: "What We Provide",
          sections: [
            {
              title: "Certificates of Authenticity",
              content: "Artists can create official certificates of authentication for their work, establishing a permanent record of the artwork's origin, creator, and initial verification. Each certificate is uniquely numbered and can be verified by collectors, galleries, and institutions."
            },
            {
              title: "Provenance Tracking",
              content: "Maintain a complete chain of custody for your artwork. Document every sale, transfer, and location change. Know where your art has been sold, who has owned it, and where it currently resides. This comprehensive history adds value and authenticity to your work."
            },
            {
              title: "Blockchain Verification",
              content: "Coming soon: All certificates and provenance records will be secured on the Avalanche blockchain, ensuring immutability and permanent verification. This blockchain-backed system provides an unalterable record that can be trusted by collectors, auction houses, and museums worldwide."
            }
          ]
        },
        whyItMatters: {
          title: "Why Provenance Matters",
          paragraphs: [
            "Provenance—the documented history of an artwork's ownership and authenticity—is one of the most critical factors in determining an artwork's value and legitimacy. Without proper documentation, even genuine works can be questioned, and artists lose control over their work's narrative.",
            "By providing artists with the tools to create and maintain comprehensive provenance records from the moment of creation, we help protect their work's integrity, increase its value, and preserve their artistic legacy for future generations."
          ]
        },
        founders: {
          title: "Our Founders",
          founders: [
            {
              name: "Bryson Brooks",
              role: "Co-Founder & Artist",
              bio: "Bryson Brooks is an internationally recognized artist originally from North Texas and now based in San Antonio. Known as both a painter and performance artist, his unique style blends playful, impressionistic techniques with emotional depth. After earning his Bachelor of Fine Arts from the University of Texas at Austin, Brooks spent time in Mexico City developing his visual and performative work. His notable large-scale landscape paintings \"Dawn\" and \"Dusk,\" created for Texas A&M University-San Antonio, showcase his bold use of color, lines, and metallic elements to evoke dreamlike, surreal landscapes."
            },
            {
              name: "Timothy Lefkowitz",
              role: "Co-Founder & Developer",
              bio: "Timothy Lefkowitz is a multifaceted professional based in San Antonio, combining accomplished software development with creative visual artistry. As a Software Engineer at Accenture Federal Services, he specializes in Java, Akka, Kafka, and Openshift, with expertise in full-stack development and web applications. In addition to his technical background, Lefkowitz is an established photographer and artist, having exhibited his work at numerous venues in San Antonio. His artistic practice, which emphasizes light as a powerful motif, uniquely informs his approach to building technology solutions for artists."
            }
          ]
        },
        callToAction: {
          title: "Get Started",
          description: "Begin documenting your artwork's journey today. Create your first certificate of authenticity and start building the provenance record that will protect and enhance your work's value for years to come."
        }
      };
      
      // Ensure data directory exists
      try {
        await fs.mkdir(path.dirname(ABOUT_CONTENT_PATH), { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, ignore
      }
      
      // Write default content
      await fs.writeFile(ABOUT_CONTENT_PATH, JSON.stringify(defaultContent, null, 2), 'utf8');
      return defaultContent;
    }
    
    console.error('Error reading about content:', error);
    throw new Error('Failed to read about content');
  }
}

/**
 * Update about page content (admin only)
 */
export async function updateAboutContent(content: AboutContent) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to update about content' };
    }

    // Validate content structure
    if (!content.header || !content.mission || !content.whatWeProvide || !content.whyItMatters || !content.founders || !content.callToAction) {
      return { error: 'Invalid content structure' };
    }

    // Write to file
    await fs.writeFile(ABOUT_CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');

    // Revalidate the about page
    revalidatePath('/about');
    revalidatePath('/admin/about');

    return { success: true };
  } catch (error) {
    console.error('Error updating about content:', error);
    return { error: error instanceof Error ? error.message : 'Failed to update about content' };
  }
}

