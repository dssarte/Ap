-- Merge the legacy Trinoma ticket scope into F Trinoma for Anna Marie.
-- Ticket comments do not store a store name; they remain attached through
-- ticket_id and therefore move with their parent ticket automatically.

BEGIN;

-- SQL Editor sessions do not carry an application admin JWT, so temporarily
-- pause the self-service privilege guard for this controlled profile update.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'protect_user_privileges'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.users DISABLE TRIGGER protect_user_privileges;
  END IF;
END;
$$;

-- Replace Trinoma with F Trinoma for this branch manager, keep F Trinoma when
-- already present, and remove any duplicate store entries.
UPDATE public.users AS u
SET assigned_stores = (
      SELECT coalesce(jsonb_agg(deduplicated.store_name ORDER BY deduplicated.first_position), '[]'::jsonb)
      FROM (
        SELECT
          min(candidate.store_name) AS store_name,
          min(candidate.position) AS first_position
        FROM (
          SELECT
            CASE
              WHEN lower(trim(assigned.value)) IN ('trinoma', 'f trinoma') THEN 'F Trinoma'
              ELSE trim(assigned.value)
            END AS store_name,
            assigned.position
          FROM jsonb_array_elements_text(coalesce(u.assigned_stores, '[]'::jsonb))
            WITH ORDINALITY AS assigned(value, position)

          -- Ensure F Trinoma remains assigned even if the legacy value was
          -- missing from an inconsistent profile.
          UNION ALL
          SELECT 'F Trinoma', 9223372036854775807::bigint
        ) AS candidate
        WHERE nullif(candidate.store_name, '') IS NOT NULL
        GROUP BY lower(candidate.store_name)
      ) AS deduplicated
    ),
    store_name = CASE
      WHEN lower(trim(coalesce(u.store_name, ''))) = 'trinoma' THEN NULL
      ELSE u.store_name
    END,
    brand_id = CASE
      WHEN lower(trim(coalesce(u.store_name, ''))) = 'trinoma' THEN NULL
      ELSE u.brand_id
    END,
    updated_date = now()
WHERE lower(trim(u.email)) = 'annamariesarte28@gmail.com'
  AND u.user_type = 'store_manager';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'protect_user_privileges'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.users ENABLE TRIGGER protect_user_privileges;
  END IF;
END;
$$;

-- Move all legacy Trinoma tickets, regardless of status or approval state.
UPDATE public.tickets
SET store_name = 'F Trinoma',
    updated_date = now()
WHERE lower(trim(coalesce(store_name, ''))) = 'trinoma';

COMMIT;

-- Verification: the assignment should contain F Trinoma but not Trinoma,
-- and the legacy ticket count should be zero.
SELECT email, assigned_stores
FROM public.users
WHERE lower(trim(email)) = 'annamariesarte28@gmail.com';

SELECT
  count(*) FILTER (WHERE lower(trim(coalesce(store_name, ''))) = 'trinoma') AS legacy_trinoma_tickets,
  count(*) FILTER (WHERE lower(trim(coalesce(store_name, ''))) = 'f trinoma') AS f_trinoma_tickets
FROM public.tickets;
