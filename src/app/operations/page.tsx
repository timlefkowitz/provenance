/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { OperationsPageContent } from './_components/operations-page-content';

export const metadata = {
  title: 'Operations | Provenance',
  description: 'Loan agreements and invoices for your collection',
};

export type OperationsExhibitionRef = {
  id: string;
  title: string;
  start_date: string | null;
};

export type OperationsArtworkOption = {
  id: string;
  title: string;
  artist_name: string | null;
  exhibitions: OperationsExhibitionRef[];
};

export type LoanAgreementRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  borrower_name: string;
  borrower_email: string | null;
  lender_name: string | null;
  lender_email: string | null;
  start_date: string | null;
  end_date: string | null;
  terms_text: string | null;
  conditions_text: string | null;
  insurance_requirements_text: string | null;
  status: string;
  signature_completed_at: string | null;
  signature_notes: string | null;
  created_at: string;
  updated_at: string;
  renewal_count: number | null;
  original_loan_id: string | null;
  alert_sent_at: string | null;
  borrower_user_id: string | null;
  lender_user_id: string | null;
  artwork: { id: string; title: string } | null;
};

export type ConsignmentRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  consignee_name: string;
  consignee_email: string | null;
  start_date: string | null;
  end_date: string | null;
  commission_rate_bps: number | null;
  reserve_price_cents: number | null;
  status: string;
  terms_text: string | null;
  notes: string | null;
  document_storage_path: string | null;
  sold_at: string | null;
  sale_price_cents: number | null;
  alert_sent_at: string | null;
  consignee_user_id: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type ConditionReportRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  loan_agreement_id: string | null;
  consignment_id: string | null;
  report_type: string;
  condition_grade: string | null;
  description: string | null;
  inspector_name: string | null;
  inspection_date: string | null;
  attachments_storage_paths: string[] | null;
  created_at: string;
  artwork: { id: string; title: string } | null;
};

export type ProvenanceEventSummary = {
  id: string;
  artwork_id: string;
  event_type: string;
  event_date: string;
  metadata: Record<string, unknown> | null;
  artwork: { id: string; title: string } | null;
};

export type InvoiceLineRow = {
  id: string;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  sort_order: number;
};

export type InvoiceRow = {
  id: string;
  account_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  status: string;
  currency: string;
  due_date: string | null;
  tax_cents: number;
  notes: string | null;
  artwork_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_line_items: InvoiceLineRow[];
};

export type ShipmentRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  courier_name: string;
  courier_contact_email: string | null;
  courier_user_id: string | null;
  origin_location: string | null;
  destination_location: string | null;
  ship_date: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  tracking_number: string | null;
  transit_insurance_policy: string | null;
  transit_insurance_value_cents: number | null;
  crating_notes: string | null;
  status: string;
  document_storage_path: string | null;
  alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type InsuranceValuationRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  policy_number: string | null;
  insurer_name: string;
  insurer_contact_email: string | null;
  insurer_user_id: string | null;
  coverage_amount_cents: number | null;
  currency: string;
  appraiser_name: string | null;
  appraiser_email: string | null;
  appraiser_user_id: string | null;
  appraisal_date: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  valuation_notes: string | null;
  status: string;
  document_storage_path: string | null;
  alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type AcquisitionRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  acquisition_type: string;
  seller_name: string;
  seller_email: string | null;
  seller_user_id: string | null;
  acquisition_price_cents: number | null;
  currency: string;
  acquisition_date: string | null;
  provenance_notes: string | null;
  accession_number: string | null;
  legal_status: string;
  fund_source: string | null;
  status: string;
  document_storage_path: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type ExhibitionPlanRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  exhibition_id: string | null;
  exhibition_title: string | null;
  venue_name: string | null;
  venue_location: string | null;
  install_date: string | null;
  deinstall_date: string | null;
  object_label: string | null;
  lender_name: string | null;
  lender_email: string | null;
  lender_user_id: string | null;
  curator_name: string | null;
  curator_email: string | null;
  curator_user_id: string | null;
  status: string;
  notes: string | null;
  document_storage_path: string | null;
  alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
  exhibition: { id: string; title: string; start_date: string | null; end_date: string | null } | null;
};

export type ArtworkLocationRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  location_type: string;
  location_name: string | null;
  room: string | null;
  shelf: string | null;
  crate_label: string | null;
  custodian_name: string | null;
  custodian_email: string | null;
  custodian_user_id: string | null;
  moved_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type VendorRow = {
  id: string;
  account_id: string;
  name: string;
  service_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_user_id: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type UserExhibitionOption = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
};

export default async function OperationsPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    redirect('/subscription?upgrade=1');
  }

  const [
    loansRes,
    invoicesRes,
    artworksRes,
    consignmentsRes,
    conditionRes,
    shipmentsRes,
    insuranceRes,
    acquisitionsRes,
    exhibitionPlansRes,
    artworkLocationsRes,
    vendorsRes,
    userExhibitionsRes,
  ] = await Promise.all([
    (client as any)
      .from('artwork_loan_agreements')
      .select(
        `
        id,
        account_id,
        artwork_id,
        borrower_name,
        borrower_email,
        lender_name,
        lender_email,
        start_date,
        end_date,
        terms_text,
        conditions_text,
        insurance_requirements_text,
        status,
        signature_completed_at,
        signature_notes,
        created_at,
        updated_at,
        renewal_count,
        original_loan_id,
        alert_sent_at,
        borrower_user_id,
        lender_user_id,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('invoices')
      .select(
        `
        id,
        account_id,
        invoice_number,
        client_name,
        client_email,
        status,
        currency,
        due_date,
        tax_cents,
        notes,
        artwork_id,
        sent_at,
        paid_at,
        created_at,
        updated_at,
        invoice_line_items(id, description, quantity, unit_amount_cents, sort_order)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('artworks')
      .select(
        `
        id,
        title,
        artist_name,
        exhibition_artworks (
          exhibition_id,
          exhibitions!exhibition_artworks_exhibition_id_fkey ( id, title, start_date )
        )
      `,
      )
      .eq('account_id', user.id)
      .order('title'),
    (client as any)
      .from('consignments')
      .select(
        `
        id,
        account_id,
        artwork_id,
        consignee_name,
        consignee_email,
        start_date,
        end_date,
        commission_rate_bps,
        reserve_price_cents,
        status,
        terms_text,
        notes,
        document_storage_path,
        sold_at,
        sale_price_cents,
        alert_sent_at,
        consignee_user_id,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('condition_reports')
      .select(
        `
        id,
        account_id,
        artwork_id,
        loan_agreement_id,
        consignment_id,
        report_type,
        condition_grade,
        description,
        inspector_name,
        inspection_date,
        attachments_storage_paths,
        created_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    (client as any)
      .from('artwork_shipments')
      .select(
        `
        id,
        account_id,
        artwork_id,
        courier_name,
        courier_contact_email,
        courier_user_id,
        origin_location,
        destination_location,
        ship_date,
        estimated_arrival,
        actual_arrival,
        tracking_number,
        transit_insurance_policy,
        transit_insurance_value_cents,
        crating_notes,
        status,
        document_storage_path,
        alert_sent_at,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('insurance_valuations')
      .select(
        `
        id,
        account_id,
        artwork_id,
        policy_number,
        insurer_name,
        insurer_contact_email,
        insurer_user_id,
        coverage_amount_cents,
        currency,
        appraiser_name,
        appraiser_email,
        appraiser_user_id,
        appraisal_date,
        policy_start_date,
        policy_end_date,
        valuation_notes,
        status,
        document_storage_path,
        alert_sent_at,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('acquisitions')
      .select(
        `
        id,
        account_id,
        artwork_id,
        acquisition_type,
        seller_name,
        seller_email,
        seller_user_id,
        acquisition_price_cents,
        currency,
        acquisition_date,
        provenance_notes,
        accession_number,
        legal_status,
        fund_source,
        status,
        document_storage_path,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('exhibition_object_plans')
      .select(
        `
        id,
        account_id,
        artwork_id,
        exhibition_id,
        exhibition_title,
        venue_name,
        venue_location,
        install_date,
        deinstall_date,
        object_label,
        lender_name,
        lender_email,
        lender_user_id,
        curator_name,
        curator_email,
        curator_user_id,
        status,
        notes,
        document_storage_path,
        alert_sent_at,
        created_at,
        updated_at,
        artwork:artworks(id, title),
        exhibition:exhibitions(id, title, start_date, end_date)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('artwork_locations')
      .select(
        `
        id,
        account_id,
        artwork_id,
        location_type,
        location_name,
        room,
        shelf,
        crate_label,
        custodian_name,
        custodian_email,
        custodian_user_id,
        moved_at,
        status,
        notes,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('vendors')
      .select(
        `
        id,
        account_id,
        name,
        service_type,
        contact_name,
        contact_email,
        contact_user_id,
        phone,
        website,
        address,
        notes,
        status,
        created_at,
        updated_at
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('exhibitions')
      .select('id, title, start_date, end_date, location')
      .eq('gallery_id', user.id)
      .order('start_date', { ascending: false })
      .limit(200),
  ]);

  if (loansRes.error) {
    console.error('[Operations] page: loans query failed', loansRes.error);
  }
  if (invoicesRes.error) {
    console.error('[Operations] page: invoices query failed', invoicesRes.error);
  }
  if (artworksRes.error) {
    console.error('[Operations] page: artworks query failed', artworksRes.error);
  }
  if (consignmentsRes.error) {
    console.error('[Operations] page: consignments query failed', consignmentsRes.error);
  }
  if (conditionRes.error) {
    console.error('[Operations] page: condition reports query failed', conditionRes.error);
  }
  if (shipmentsRes.error) {
    console.error('[Operations] page: shipments query failed', shipmentsRes.error);
  }
  if (insuranceRes.error) {
    console.error('[Operations] page: insurance query failed', insuranceRes.error);
  }
  if (acquisitionsRes.error) {
    console.error('[Operations] page: acquisitions query failed', acquisitionsRes.error);
  }
  if (exhibitionPlansRes.error) {
    console.error('[Operations] page: exhibition plans query failed', exhibitionPlansRes.error);
  }
  if (artworkLocationsRes.error) {
    console.error('[Operations] page: artwork locations query failed', artworkLocationsRes.error);
  }
  if (vendorsRes.error) {
    console.error('[Operations] page: vendors query failed', vendorsRes.error);
  }
  if (userExhibitionsRes.error) {
    console.error('[Operations] page: user exhibitions query failed', userExhibitionsRes.error);
  }

  const rawLoans = (loansRes.data ?? []) as Record<string, unknown>[];
  const loans: LoanAgreementRow[] = rawLoans.map((row) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    const artwork = Array.isArray(art) ? art[0] ?? null : art ?? null;
    return { ...(row as unknown as LoanAgreementRow), artwork };
  });

  const rawCons = (consignmentsRes.data ?? []) as Record<string, unknown>[];
  const consignments: ConsignmentRow[] = rawCons.map((row) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    const artwork = Array.isArray(art) ? art[0] ?? null : art ?? null;
    return { ...(row as unknown as ConsignmentRow), artwork };
  });

  const rawCond = (conditionRes.data ?? []) as Record<string, unknown>[];
  const conditionReports: ConditionReportRow[] = rawCond.map((row) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    const artwork = Array.isArray(art) ? art[0] ?? null : art ?? null;
    return { ...(row as unknown as ConditionReportRow), artwork };
  });

  const mapArtwork = (row: Record<string, unknown>) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    return Array.isArray(art) ? art[0] ?? null : art ?? null;
  };
  const shipments: ShipmentRow[] = ((shipmentsRes.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({ ...(row as unknown as ShipmentRow), artwork: mapArtwork(row) }),
  );
  const insuranceValuations: InsuranceValuationRow[] = (
    (insuranceRes.data ?? []) as Record<string, unknown>[]
  ).map((row) => ({ ...(row as unknown as InsuranceValuationRow), artwork: mapArtwork(row) }));
  const acquisitions: AcquisitionRow[] = ((acquisitionsRes.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({ ...(row as unknown as AcquisitionRow), artwork: mapArtwork(row) }),
  );

  const mapExhibition = (row: Record<string, unknown>) => {
    const ex = row.exhibition as
      | { id: string; title: string; start_date: string | null; end_date: string | null }
      | { id: string; title: string; start_date: string | null; end_date: string | null }[]
      | null
      | undefined;
    return Array.isArray(ex) ? ex[0] ?? null : ex ?? null;
  };
  const exhibitionPlans: ExhibitionPlanRow[] = (
    (exhibitionPlansRes.data ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    ...(row as unknown as ExhibitionPlanRow),
    artwork: mapArtwork(row),
    exhibition: mapExhibition(row),
  }));
  const artworkLocations: ArtworkLocationRow[] = ((artworkLocationsRes.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({ ...(row as unknown as ArtworkLocationRow), artwork: mapArtwork(row) }),
  );
  const vendors: VendorRow[] = (vendorsRes.data ?? []) as VendorRow[];
  const userExhibitions: UserExhibitionOption[] = (userExhibitionsRes.data ?? []) as UserExhibitionOption[];

  const rawInvoices = (invoicesRes.data ?? []) as Record<string, unknown>[];
  const invoices: InvoiceRow[] = rawInvoices.map((inv) => {
    const lines = (inv.invoice_line_items as InvoiceLineRow[] | null) ?? [];
    const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
    return { ...(inv as unknown as InvoiceRow), invoice_line_items: sorted };
  });

  const rawArtworks = (artworksRes.data ?? []) as { id: string }[];
  const artworkIdList = rawArtworks.map((a) => a.id);
  let provRes: { data: unknown; error: unknown } = { data: null, error: null };
  if (artworkIdList.length) {
    provRes = await (client as any)
      .from('provenance_events')
      .select(`id, artwork_id, event_type, event_date, metadata, artwork:artworks(id, title)`)
      .in('artwork_id', artworkIdList)
      .order('event_date', { ascending: false })
      .limit(25);
    if (provRes.error) {
      console.error('[Operations] page: provenance events query failed', provRes.error);
    }
  }

  const rawProv = (provRes.data ?? []) as Record<string, unknown>[];
  const recentProvenance: ProvenanceEventSummary[] = rawProv.map((row) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    const artwork = Array.isArray(art) ? art[0] ?? null : art ?? null;
    return {
      id: row.id as string,
      artwork_id: row.artwork_id as string,
      event_type: row.event_type as string,
      event_date: row.event_date as string,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      artwork,
    };
  });

  const rawArtworksFull = (artworksRes.data ?? []) as Record<string, unknown>[];
  const artworks: OperationsArtworkOption[] = rawArtworksFull.map((row) => {
    const links = (row.exhibition_artworks as Record<string, unknown>[] | null) ?? [];
    const exById = new Map<string, OperationsExhibitionRef>();
    for (const link of links) {
      const exRaw = link.exhibitions as
        | { id: string; title: string; start_date: string | null }
        | { id: string; title: string; start_date: string | null }[]
        | null
        | undefined;
      const ex = Array.isArray(exRaw) ? exRaw[0] : exRaw;
      if (ex?.id) {
        exById.set(ex.id, {
          id: ex.id,
          title: typeof ex.title === 'string' ? ex.title : 'Exhibition',
          start_date: ex.start_date ?? null,
        });
      }
    }
    return {
      id: row.id as string,
      title: (row.title as string) ?? '',
      artist_name: (row.artist_name as string | null) ?? null,
      exhibitions: [...exById.values()],
    };
  });

  console.log('[Operations] page loaded', {
    loans: loans.length,
    invoices: invoices.length,
    artworks: artworks.length,
    consignments: consignments.length,
    conditionReports: conditionReports.length,
    shipments: shipments.length,
    insurance: insuranceValuations.length,
    acquisitions: acquisitions.length,
    exhibitionPlans: exhibitionPlans.length,
    artworkLocations: artworkLocations.length,
    vendors: vendors.length,
    userExhibitions: userExhibitions.length,
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">Operations</h1>
        <p className="text-ink/70 font-serif max-w-3xl">
          Manage loans, consignments, condition reports, and invoices with alerts and a provenance trail
          for your collection.
        </p>
      </div>

      <OperationsPageContent
        initialLoans={loans}
        initialInvoices={invoices}
        initialConsignments={consignments}
        initialConditionReports={conditionReports}
        initialShipments={shipments}
        initialInsuranceValuations={insuranceValuations}
        initialAcquisitions={acquisitions}
        initialExhibitionPlans={exhibitionPlans}
        initialArtworkLocations={artworkLocations}
        initialVendors={vendors}
        userExhibitions={userExhibitions}
        recentProvenance={recentProvenance}
        artworks={artworks}
      />
    </div>
  );
}
