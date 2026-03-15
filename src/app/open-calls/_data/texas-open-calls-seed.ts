/**
 * 20 Texas-focused open calls for seeding the database.
 * Curated listings: when external_url is set, the detail page links out to the real open call.
 * Some entries are based on real opportunities; others are representative examples.
 */

export type TexasOpenCallSeed = {
  title: string;
  description: string;
  location: string;
  start_date: string; // YYYY-MM-DD exhibition
  end_date: string | null;
  submission_open_date: string;
  submission_closing_date: string;
  call_type: 'exhibition' | 'art';
  eligible_locations: string[];
  /** Link to the real open call / application page. Required for seed entries (curated listings). */
  external_url: string;
};

export const TEXAS_OPEN_CALLS_SEED: TexasOpenCallSeed[] = [
  {
    title: 'Artpace Texas Open Call',
    description:
      'Artpace San Antonio annual open call for Texas artists. Selected residents receive $6,000 stipend, up to $10,000 production budget, furnished apartment, and studio space. Must have lived in Texas for at least one year.',
    location: 'San Antonio, TX',
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    submission_open_date: '2025-07-14',
    submission_closing_date: '2025-08-25',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://artpace.org/about/international-artist-in-residence/texas-open-call/',
  },
  {
    title: 'ACLU of Texas Artist-in-Residence',
    description:
      'Collaborative performance and visual arts projects focused on civil liberties and civil rights. $30,000 stipend. Focus areas: free speech in K-12 schools, reproductive freedom, LGBTQIA+ equality. Texas-based artists and collectives, any medium.',
    location: 'Austin, TX',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    submission_open_date: '2025-11-01',
    submission_closing_date: '2026-02-28',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.aclutx.org/',
  },
  {
    title: 'Texas Commission on the Arts Virtual Residencies',
    description:
      'Four virtual residencies: Ocean, Our Land, Atmos-fear, and Sustainability. Environmental themes. No application fee; participation costs vary. Open to Texas artists.',
    location: 'Statewide (Virtual)',
    start_date: '2026-01-01',
    end_date: null,
    submission_open_date: '2025-09-01',
    submission_closing_date: '2026-01-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.arts.texas.gov/jobs/virtual-art-residencies-open-call/',
  },
  {
    title: 'Houston Art League Annual Exhibition',
    description:
      'Annual juried exhibition for Texas artists. Painting, sculpture, photography, and mixed media. Cash awards. Exhibition in Houston Art League gallery.',
    location: 'Houston, TX',
    start_date: '2026-03-01',
    end_date: '2026-04-30',
    submission_open_date: '2025-10-01',
    submission_closing_date: '2026-01-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Houston'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Dallas Art Fair Open Call',
    description:
      'Open call for North Texas artists to exhibit in the Dallas Art Fair emerging section. Galleries and independent artists welcome. Focus on contemporary painting and sculpture.',
    location: 'Dallas, TX',
    start_date: '2026-04-10',
    end_date: '2026-04-13',
    submission_open_date: '2025-11-01',
    submission_closing_date: '2026-02-01',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Dallas', 'Fort Worth'],
    external_url: 'https://dallasartfair.com/',
  },
  {
    title: 'Austin Studio Tour Open Call',
    description:
      'Apply to be a featured artist in the Austin Studio Tour. Open to Austin-area artists working in all media. Selected artists receive studio visibility and inclusion in printed and digital materials.',
    location: 'Austin, TX',
    start_date: '2026-11-01',
    end_date: '2026-11-15',
    submission_open_date: '2026-03-01',
    submission_closing_date: '2026-06-30',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Austin'],
    external_url: 'https://www.bigmedium.org/',
  },
  {
    title: 'San Antonio Art Fund Grant',
    description:
      'Project-based grants for San Antonio artists. Funding for new work, exhibitions, or public art. All disciplines. Must be based in Bexar County or surrounding area.',
    location: 'San Antonio, TX',
    start_date: '2026-01-01',
    end_date: null,
    submission_open_date: '2025-09-15',
    submission_closing_date: '2025-12-01',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'San Antonio', 'Bexar County'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Fort Worth Art Grant Program',
    description:
      'Grants for Fort Worth artists to create new work or mount exhibitions. Painting, sculpture, photography, and time-based media. Juried by local curators.',
    location: 'Fort Worth, TX',
    start_date: '2026-06-01',
    end_date: '2026-12-31',
    submission_open_date: '2026-01-01',
    submission_closing_date: '2026-03-31',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Fort Worth'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Marfa Open Call',
    description:
      'Open call for artists to exhibit in Marfa gallery spaces. Emphasis on contemporary and conceptual work. Selected artists receive exhibition and possible residency component.',
    location: 'Marfa, TX',
    start_date: '2026-05-01',
    end_date: '2026-08-31',
    submission_open_date: '2025-12-01',
    submission_closing_date: '2026-02-28',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Marfa'],
    external_url: 'https://glasstire.com/',
  },
  {
    title: 'El Paso Museum of Art Biennial',
    description:
      'Biennial juried exhibition for artists in Texas and the greater Southwest. All media. Acquisition consideration. Exhibition at El Paso Museum of Art.',
    location: 'El Paso, TX',
    start_date: '2026-09-01',
    end_date: '2027-02-28',
    submission_open_date: '2026-01-01',
    submission_closing_date: '2026-04-30',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'El Paso', 'New Mexico', 'Arizona'],
    external_url: 'https://epma.art/',
  },
  {
    title: 'Houston Center for Contemporary Craft Open Call',
    description:
      'Open call for craft-based and material-focused artists. Ceramics, fiber, metal, wood, glass. Exhibition opportunity at HCCC. Texas and national artists eligible.',
    location: 'Houston, TX',
    start_date: '2026-02-01',
    end_date: '2026-05-31',
    submission_open_date: '2025-08-01',
    submission_closing_date: '2025-11-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Houston'],
    external_url: 'https://crafthouston.org/',
  },
  {
    title: 'Texas Sculpture Symposium Open Call',
    description:
      'Open call for sculptors to present work at the annual Texas Sculpture Symposium. Indoor and outdoor work considered. Stipend for selected artists.',
    location: 'Various, TX',
    start_date: '2026-10-01',
    end_date: '2026-10-15',
    submission_open_date: '2026-02-01',
    submission_closing_date: '2026-05-31',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Austin Art Alliance Residency',
    description:
      'Three-month residency for Texas-based artists. Studio space and stipend. Focus on experimentation and community engagement. All media.',
    location: 'Austin, TX',
    start_date: '2026-06-01',
    end_date: '2026-08-31',
    submission_open_date: '2025-12-01',
    submission_closing_date: '2026-02-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Austin'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Dallas Contemporary New Talent',
    description:
      'Annual open call for emerging artists in North Texas. Selected artists receive exhibition at Dallas Contemporary and inclusion in programming.',
    location: 'Dallas, TX',
    start_date: '2026-07-01',
    end_date: '2026-09-30',
    submission_open_date: '2026-01-15',
    submission_closing_date: '2026-04-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Dallas'],
    external_url: 'https://dallascontemporary.org/',
  },
  {
    title: 'Texas Photographic Society National Call',
    description:
      'National call with strong Texas representation. Photography only. Juried exhibition and publication. Cash awards. TPS members and non-members eligible.',
    location: 'Statewide, TX',
    start_date: '2026-05-01',
    end_date: '2026-07-31',
    submission_open_date: '2026-01-01',
    submission_closing_date: '2026-03-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.texasphoto.org/',
  },
  {
    title: 'Galveston Arts Center Open Call',
    description:
      'Open call for Gulf Coast and Texas artists. Exhibition in Galveston Arts Center galleries. All media. Emphasis on work responsive to place and community.',
    location: 'Galveston, TX',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
    submission_open_date: '2025-11-01',
    submission_closing_date: '2026-01-31',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Galveston', 'Gulf Coast'],
    external_url: 'https://galvestonartscenter.org/',
  },
  {
    title: 'Texas State Art Faculty Biennial',
    description:
      'Open to current and recent Texas university art faculty. Juried exhibition. Painting, sculpture, printmaking, photography, digital, and interdisciplinary.',
    location: 'San Marcos, TX',
    start_date: '2026-02-01',
    end_date: '2026-04-30',
    submission_open_date: '2025-10-01',
    submission_closing_date: '2025-12-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Big Medium Texas Biennial',
    description:
      'Statewide survey of contemporary art in Texas. All media. Juried by external curators. Exhibition in Austin with possible touring.',
    location: 'Austin, TX',
    start_date: '2026-09-01',
    end_date: '2026-12-31',
    submission_open_date: '2026-02-01',
    submission_closing_date: '2026-05-01',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.bigmedium.org/',
  },
  {
    title: 'Texas Emerging Artist Grant',
    description:
      'Grants for Texas artists early in their careers. Funding for materials, studio, or exhibition costs. Application includes work samples and statement.',
    location: 'Statewide, TX',
    start_date: '2026-01-01',
    end_date: null,
    submission_open_date: '2025-09-01',
    submission_closing_date: '2025-11-30',
    call_type: 'exhibition',
    eligible_locations: ['Texas'],
    external_url: 'https://www.arts.texas.gov/',
  },
  {
    title: 'Houston Print Fair Open Call',
    description:
      'Open call for printmakers to exhibit at Houston Print Fair. Traditional and experimental printmaking. Texas and national artists. Booth and exhibition opportunity.',
    location: 'Houston, TX',
    start_date: '2026-03-15',
    end_date: '2026-03-17',
    submission_open_date: '2025-10-01',
    submission_closing_date: '2026-01-15',
    call_type: 'exhibition',
    eligible_locations: ['Texas', 'Houston'],
    external_url: 'https://www.arts.texas.gov/',
  },
];
