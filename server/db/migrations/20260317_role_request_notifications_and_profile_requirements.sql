begin;

-- Notify the requester when a role upgrade request is created.
create or replace function public.create_role_upgrade_request_notification()
returns trigger
language plpgsql
as $$
begin
  insert into public.notifications (user_id, type, message, data)
  values (
    new.user_id,
    'role_upgrade_request_sent',
    case
      when new.desired_role = 'venue_member'
        then 'Tu solicitud para usar cuenta de dueño de cancha fue enviada. Te avisaremos cuando se revise.'
      else 'Tu solicitud para usar cuenta de club fue enviada. Te avisaremos cuando se revise.'
    end,
    jsonb_build_object(
      'requestId', new.id,
      'desiredRole', new.desired_role,
      'status', new.status,
      'targetEmail', new.target_email
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_create_role_upgrade_request_notification on public.role_upgrade_requests;
create trigger trg_create_role_upgrade_request_notification
after insert on public.role_upgrade_requests
for each row
execute function public.create_role_upgrade_request_notification();

commit;
