-- Visual preset for transactional email shells (masthead + card chrome).

alter table public.email_settings
add column if not exists layout_preset text not null default 'studio';

comment on column public.email_settings.layout_preset is
  'Email layout: studio | heritage | archive (see apps email-layout-presets).';
