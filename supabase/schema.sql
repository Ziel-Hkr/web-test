-- FixDorm MVP schema. Run in Supabase SQL Editor as the project owner.
create extension if not exists pgcrypto;

create type public.fixdorm_role as enum ('resident', 'admin', 'technician');
create type public.fixdorm_status as enum ('pending_verification', 'awaiting_technician', 'awaiting_confirmation', 'accepted', 'in_progress', 'waiting_parts', 'completed');
create type public.fixdorm_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.fixdorm_assignment_status as enum ('offered', 'accepted', 'declined', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.fixdorm_role not null default 'resident',
  created_at timestamptz not null default now()
);

create table public.technicians (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  availability text not null default 'available' check (availability in ('available', 'busy', 'off_duty')),
  jobs_completed integer not null default 0 check (jobs_completed >= 0),
  rating numeric(2,1) not null default 5.0 check (rating between 0 and 5),
  updated_at timestamptz not null default now()
);

create table public.technician_skills (
  technician_id uuid not null references public.technicians(user_id) on delete cascade,
  category text not null check (category in ('Kelistrikan', 'Peralatan elektronik', 'Perpipaan & air', 'Furniture', 'Bangunan & fasilitas umum', 'Lainnya')),
  primary key (technician_id, category)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  technician_id uuid references public.profiles(id) on delete set null,
  item_name text not null check (char_length(item_name) between 1 and 100),
  category text not null check (category in ('Kelistrikan', 'Peralatan elektronik', 'Perpipaan & air', 'Furniture', 'Bangunan & fasilitas umum', 'Lainnya')),
  building text not null check (char_length(building) between 1 and 80),
  room text not null check (char_length(room) between 1 and 100),
  description text not null check (char_length(description) between 1 and 1000),
  status public.fixdorm_status not null default 'pending_verification',
  priority public.fixdorm_priority not null default 'normal',
  photo_path text,
  completion_photo_path text,
  estimated_hours numeric(5,1) check (estimated_hours > 0 and estimated_hours <= 168),
  rating integer check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  technician_id uuid not null references public.technicians(user_id) on delete cascade,
  status public.fixdorm_assignment_status not null default 'offered',
  offered_by uuid references public.profiles(id) on delete set null,
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (report_id, technician_id)
);

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.fixdorm_status,
  to_status public.fixdorm_status not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reviews (
  report_id uuid not null references public.reports(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  technician_id uuid not null references public.technicians(user_id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (report_id, resident_id)
);

create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index reports_technician_status_idx on public.reports (technician_id, status, created_at desc);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index report_events_report_created_idx on public.report_events (report_id, created_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.current_fixdorm_role()
returns public.fixdorm_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function public.is_fixdorm_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_fixdorm_role() = 'admin'::public.fixdorm_role, false) $$;

create or replace function public.create_fixdorm_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'resident');
  return new;
end;
$$;

create trigger on_auth_user_created_fixdorm
  after insert on auth.users for each row execute procedure public.create_fixdorm_profile();

create or replace function public.touch_fixdorm_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

create trigger reports_touch_updated_at before update on public.reports
  for each row execute procedure public.touch_fixdorm_updated_at();
create trigger technicians_touch_updated_at before update on public.technicians
  for each row execute procedure public.touch_fixdorm_updated_at();

-- A technician may only progress the work currently assigned to them.
create or replace function public.guard_fixdorm_report_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare user_role public.fixdorm_role;
begin
  select role into user_role from public.profiles where id = (select auth.uid());
  if user_role = 'admin' then return new; end if;
  if user_role = 'resident' and old.reporter_id = (select auth.uid()) then
    if new.reporter_id is distinct from old.reporter_id
      or new.technician_id is distinct from old.technician_id
      or new.item_name is distinct from old.item_name
      or new.category is distinct from old.category
      or new.building is distinct from old.building
      or new.room is distinct from old.room
      or new.description is distinct from old.description
      or new.status is distinct from old.status
      or new.priority is distinct from old.priority
      or new.completion_photo_path is distinct from old.completion_photo_path
      or new.estimated_hours is distinct from old.estimated_hours
      or new.rating is distinct from old.rating
      or new.review is distinct from old.review then
      raise exception 'Penghuni hanya dapat melampirkan foto pada laporan miliknya.';
    end if;
    return new;
  end if;
  if user_role = 'technician' and old.technician_id = (select auth.uid()) then
    if new.reporter_id is distinct from old.reporter_id
      or (new.technician_id is distinct from old.technician_id and not (new.technician_id is null and new.status = 'awaiting_technician'))
      or new.item_name is distinct from old.item_name
      or new.category is distinct from old.category
      or new.building is distinct from old.building
      or new.room is distinct from old.room
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.photo_path is distinct from old.photo_path
      or new.rating is distinct from old.rating
      or new.review is distinct from old.review then
      raise exception 'Teknisi hanya dapat memperbarui status dan foto hasil pekerjaan.';
    end if;
    if new.status not in ('awaiting_technician', 'accepted', 'in_progress', 'waiting_parts', 'completed') then
      raise exception 'Status tersebut tidak dapat dipilih teknisi.';
    end if;
    return new;
  end if;
  raise exception 'Anda tidak diizinkan memperbarui laporan ini.';
end;
$$;
create trigger reports_guard_update before update on public.reports
  for each row execute procedure public.guard_fixdorm_report_update();

create or replace function public.notify_fixdorm_report_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid; code text; actor_role public.fixdorm_role; actor_name text; admin_id uuid;
begin
  select r.reporter_id, 'FD-' || upper(left(replace(r.id::text, '-', ''), 6))
    into owner_id, code from public.reports r where r.id = new.report_id;
  if owner_id is not null and owner_id is distinct from new.actor_id then
    insert into public.notifications (user_id, report_id, message)
    values (owner_id, new.report_id, code || ': ' || coalesce(nullif(new.note, ''), 'Status laporan berubah menjadi ' || new.to_status::text || '.'));
  end if;
  select p.role, p.full_name into actor_role, actor_name from public.profiles p where p.id = new.actor_id;
  if actor_role = 'technician' and new.to_status in ('in_progress', 'waiting_parts') then
    for admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, report_id, message)
      values (admin_id, new.report_id, code || ': ' || coalesce(nullif(actor_name, ''), 'Teknisi') || ' memperbarui pekerjaan — ' || coalesce(nullif(new.note, ''), 'status menjadi ' || new.to_status::text || '.'));
    end loop;
  end if;
  return new;
end;
$$;
create trigger report_event_notification after insert on public.report_events
  for each row execute procedure public.notify_fixdorm_report_event();

create or replace function public.notify_fixdorm_new_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare admin_id uuid; code text;
begin
  code := 'FD-' || upper(left(replace(new.id::text, '-', ''), 6));
  insert into public.notifications (user_id, report_id, message)
  values (new.reporter_id, new.id, code || ': laporan Anda diterima dan menunggu verifikasi helpdesk.');
  for admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, report_id, message)
    values (admin_id, new.id, code || ': laporan baru dari mahasiswa menunggu verifikasi.');
  end loop;
  return new;
end;
$$;
create trigger report_new_admin_notification after insert on public.reports
  for each row execute procedure public.notify_fixdorm_new_report();

create or replace function public.notify_fixdorm_job_offer()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare item text; code text; tech_name text; admin_id uuid; should_notify boolean;
begin
  if tg_op = 'INSERT' then should_notify := true; else should_notify := old.status is distinct from new.status; end if;
  if not should_notify then return new; end if;
  select r.item_name, 'FD-' || upper(left(replace(r.id::text, '-', ''), 6))
    into item, code from public.reports r where r.id = new.report_id;
  select p.full_name into tech_name from public.profiles p where p.id = new.technician_id;
  if new.status = 'offered' then
    insert into public.notifications (user_id, report_id, message)
    values (new.technician_id, new.report_id, code || ': pekerjaan baru ditawarkan — ' || item || '.');
  elsif new.status in ('accepted', 'declined', 'completed') then
    for admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, report_id, message)
      values (admin_id, new.report_id, code || ': ' || coalesce(nullif(tech_name, ''), 'Teknisi') || ' ' ||
        case new.status when 'accepted' then 'menerima' when 'declined' then 'menolak' else 'menyelesaikan' end ||
        ' pekerjaan ' || coalesce(item, 'laporan') || '.');
    end loop;
  end if;
  return new;
end;
$$;
create trigger job_offer_notification after insert or update of status on public.job_assignments
  for each row execute procedure public.notify_fixdorm_job_offer();

create or replace function public.sync_fixdorm_technician_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare active_offers integer;
begin
  select count(*)::integer into active_offers from public.job_assignments a
    where a.technician_id = new.technician_id and a.status in ('offered', 'accepted');
  update public.technicians set availability = case when active_offers > 0 then 'busy' else 'available' end
    where user_id = new.technician_id;
  return new;
end;
$$;
create trigger job_assignment_sync_technician_availability after insert or update of status on public.job_assignments
  for each row execute procedure public.sync_fixdorm_technician_availability();
update public.technicians t set availability = 'busy'
  where exists (select 1 from public.job_assignments a where a.technician_id = t.user_id and a.status in ('offered', 'accepted'));

create or replace function public.sync_fixdorm_review()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  update public.reports set rating = new.rating, review = new.comment where id = new.report_id;
  return new;
end $$;
create trigger review_sync_report after insert or update on public.reviews
  for each row execute procedure public.sync_fixdorm_review();

alter table public.profiles enable row level security;
alter table public.technicians enable row level security;
alter table public.technician_skills enable row level security;
alter table public.reports enable row level security;
alter table public.job_assignments enable row level security;
alter table public.report_events enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

create policy "Authenticated users can view staff profiles" on public.profiles
  for select to authenticated using (true);
create policy "Admins can update profiles" on public.profiles
  for update to authenticated using (public.is_fixdorm_admin()) with check (public.is_fixdorm_admin());

create policy "Authenticated users can view technician availability" on public.technicians
  for select to authenticated using (true);
create policy "Admins manage technician availability" on public.technicians
  for update to authenticated using (public.is_fixdorm_admin()) with check (public.is_fixdorm_admin());
create policy "Authenticated users can view technician skills" on public.technician_skills
  for select to authenticated using (true);
create policy "Admins manage technician skills" on public.technician_skills
  for all to authenticated using (public.is_fixdorm_admin()) with check (public.is_fixdorm_admin());

create policy "Residents create their own reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()) and public.current_fixdorm_role() = 'resident');
create policy "Users can view reports they are involved in" on public.reports
  for select to authenticated using (
    public.is_fixdorm_admin() or reporter_id = (select auth.uid()) or technician_id = (select auth.uid())
  );
create policy "Admins and assigned technicians update reports" on public.reports
  for update to authenticated using (
    public.is_fixdorm_admin() or reporter_id = (select auth.uid()) or
      (technician_id = (select auth.uid()) and public.current_fixdorm_role() = 'technician')
  ) with check (
    public.is_fixdorm_admin() or (reporter_id = (select auth.uid()) and public.current_fixdorm_role() = 'resident') or (
      public.current_fixdorm_role() = 'technician' and
      (technician_id = (select auth.uid()) or (technician_id is null and status = 'awaiting_technician'))
    )
  );

create policy "Admins and assigned technicians can see job offers" on public.job_assignments
  for select to authenticated using (public.is_fixdorm_admin() or technician_id = (select auth.uid()));
create policy "Admins create job offers" on public.job_assignments
  for insert to authenticated with check (public.is_fixdorm_admin());
create policy "Admins and technicians respond to offers" on public.job_assignments
  for update to authenticated using (public.is_fixdorm_admin() or technician_id = (select auth.uid()))
  with check (public.is_fixdorm_admin() or (technician_id = (select auth.uid()) and status in ('accepted', 'declined', 'completed')));

create policy "Participants can view report events" on public.report_events
  for select to authenticated using (exists (
    select 1 from public.reports r where r.id = report_id and
      (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
  ));
create policy "Participants can add report events" on public.report_events
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and (
      exists (
        select 1 from public.reports r where r.id = report_id and
          (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
      ) or exists (
        select 1 from public.job_assignments a where a.report_id = report_id and a.technician_id = (select auth.uid())
      )
    )
  );

create policy "Users can view their notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can mark their notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Participants view reviews" on public.reviews
  for select to authenticated using (public.is_fixdorm_admin() or resident_id = (select auth.uid()) or technician_id = (select auth.uid()));
create policy "Residents review their completed reports" on public.reviews
  for insert to authenticated with check (
    resident_id = (select auth.uid()) and exists (
      select 1 from public.reports r where r.id = report_id and r.reporter_id = (select auth.uid())
        and r.technician_id = technician_id and r.status = 'completed'
    )
  );
create policy "Residents can update their review" on public.reviews
  for update to authenticated using (resident_id = (select auth.uid()))
  with check (resident_id = (select auth.uid()));

-- Private image bucket. Each file is stored under <report UUID>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fixdorm-media', 'fixdorm-media', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants read report photos" on storage.objects
  for select to authenticated using (bucket_id = 'fixdorm-media' and exists (
    select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
      and (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
  ));
create policy "Participants upload report photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fixdorm-media' and exists (
    select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
      and (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
  ));
create policy "Participants replace report photos" on storage.objects
  for update to authenticated using (bucket_id = 'fixdorm-media' and exists (
    select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
      and (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
  )) with check (bucket_id = 'fixdorm-media' and exists (
    select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
      and (public.is_fixdorm_admin() or r.reporter_id = (select auth.uid()) or r.technician_id = (select auth.uid()))
  ));

-- Expose the realtime tables to browser clients, if they are not already published.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports') then
    alter publication supabase_realtime add table public.reports;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Provision a helpdesk or technician after the user registers:
-- update public.profiles set role = 'admin' where id = '<auth.users UUID>';
-- update public.profiles set role = 'technician' where id = '<auth.users UUID>';
-- insert into public.technicians (user_id) values ('<auth.users UUID>');
-- insert into public.technician_skills (technician_id, category) values ('<auth.users UUID>', 'Kelistrikan');

