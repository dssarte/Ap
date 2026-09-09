-- Tracks every ticket status transition with a timestamp, so Reports can
-- tell "moving" tickets (status changes often) from "non-moving" ones
-- (stuck at the same status since creation) — something handling_history
-- can't answer, since it only logs department transfers, not status.
--
-- Populated purely by a trigger (not app code), so it captures every status
-- change regardless of which screen/client made it.

BEGIN;

CREATE TABLE public.ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_status_history_ticket_id_idx ON public.ticket_status_history (ticket_id);
CREATE INDEX ticket_status_history_changed_at_idx ON public.ticket_status_history (changed_at DESC);

ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;

-- Read access mirrors the parent ticket's own access rule. Writes only ever
-- happen through the SECURITY DEFINER trigger function below, so there is
-- deliberately no INSERT/UPDATE/DELETE policy for authenticated users.
CREATE POLICY ticket_status_history_scoped_read ON public.ticket_status_history
FOR SELECT TO authenticated
USING ((SELECT private.can_access_ticket(ticket_id)));

CREATE OR REPLACE FUNCTION private.log_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_status_history (ticket_id, old_status, new_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, coalesce(NEW.created_date, now()));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_status_history (ticket_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_ticket_status_change ON public.tickets;
CREATE TRIGGER log_ticket_status_change
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.log_ticket_status_change();

-- Backfill: give every existing ticket a baseline "created" row so reports
-- don't see them as having zero history rows. This can't recover any status
-- changes that happened before this migration ran — those are genuinely
-- lost — it only establishes a starting point going forward.
INSERT INTO public.ticket_status_history (ticket_id, old_status, new_status, changed_at)
SELECT t.id, NULL, t.status, coalesce(t.created_date, now())
FROM public.tickets AS t
WHERE NOT EXISTS (
  SELECT 1 FROM public.ticket_status_history AS h WHERE h.ticket_id = t.id
);

COMMIT;
