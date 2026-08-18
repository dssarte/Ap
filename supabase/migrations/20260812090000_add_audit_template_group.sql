-- Groups audit templates under admin UI tabs (one per brand: Angel's Pizza,
-- Figaro, Tien Ma, Koobideh Kebab, Angel's Pizza Express).
-- Existing templates default to 'ap', which the app treats as Angel's Pizza.
alter table public.audit_templates
  add column if not exists template_group text not null default 'ap';

update public.audit_templates
  set template_group = 'ap'
  where template_group is null;
