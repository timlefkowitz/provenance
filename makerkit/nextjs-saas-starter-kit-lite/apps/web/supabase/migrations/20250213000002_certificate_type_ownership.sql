/*
 * Rename certificate_type value: collection → ownership
 * (Collector-created certificates are "Certificate of Ownership")
 */

update public.artworks
set certificate_type = 'ownership'
where certificate_type = 'collection';

comment on column public.artworks.certificate_type is 'Type of certificate: authenticity (artist, or after claim+verify), show (gallery), ownership (collector)';
