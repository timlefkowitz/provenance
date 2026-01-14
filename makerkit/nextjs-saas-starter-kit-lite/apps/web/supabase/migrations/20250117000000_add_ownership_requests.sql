-- Add request_type column to provenance_update_requests
alter table public.provenance_update_requests
add column if not exists request_type varchar(20) not null default 'provenance_update' 
check (request_type in ('provenance_update', 'ownership_request'));

-- Create index for request_type
create index if not exists provenance_update_requests_request_type_idx 
on public.provenance_update_requests(request_type);

