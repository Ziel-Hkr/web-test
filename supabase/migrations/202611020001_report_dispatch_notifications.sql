-- Apply this migration in the Supabase SQL Editor when upgrading an existing FixDorm database.

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

drop trigger if exists job_assignment_sync_technician_availability on public.job_assignments;
create trigger job_assignment_sync_technician_availability after insert or update of status on public.job_assignments
  for each row execute procedure public.sync_fixdorm_technician_availability();

update public.technicians t set availability = 'busy'
  where exists (select 1 from public.job_assignments a where a.technician_id = t.user_id and a.status in ('offered', 'accepted'));

