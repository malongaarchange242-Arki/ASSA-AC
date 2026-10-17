ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS daf_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS submitted_to_daf_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'factures_daf_status_check'
  ) THEN
    ALTER TABLE public.factures
      ADD CONSTRAINT factures_daf_status_check
      CHECK (daf_status IN ('not_submitted', 'pending', 'validated', 'rejected'));
  END IF;
END
$$;

WITH workflow_events AS (
  SELECT
    facture.id,
    max(journal.created_at) FILTER (
      WHERE journal.type_activite = 'submit'
        AND journal.description = 'Soumission de la facture ' || facture.numero_facture || ' au DAF pour validation'
    ) AS submitted_at,
    max(journal.created_at) FILTER (
      WHERE journal.type_activite = 'validate'
        AND journal.description = 'Validation de la facture ' || facture.numero_facture || ' par DAF'
    ) AS validated_at,
    max(journal.created_at) FILTER (
      WHERE journal.type_activite = 'reject'
        AND journal.description LIKE 'Rejet de la facture ' || facture.numero_facture || ' par DAF.%'
    ) AS rejected_at
  FROM public.factures AS facture
  LEFT JOIN public.journal_activite AS journal
    ON journal.module = 'Factures'
   AND (
     (
       journal.type_activite = 'submit'
       AND journal.description = 'Soumission de la facture ' || facture.numero_facture || ' au DAF pour validation'
     )
     OR (
       journal.type_activite = 'validate'
       AND journal.description = 'Validation de la facture ' || facture.numero_facture || ' par DAF'
     )
     OR (
       journal.type_activite = 'reject'
       AND journal.description LIKE 'Rejet de la facture ' || facture.numero_facture || ' par DAF.%'
     )
   )
  GROUP BY facture.id, facture.numero_facture
)
UPDATE public.factures AS facture
SET
  submitted_to_daf_at = workflow_events.submitted_at,
  daf_status = CASE
    WHEN workflow_events.submitted_at > GREATEST(
      COALESCE(workflow_events.validated_at, '-infinity'::timestamptz),
      COALESCE(workflow_events.rejected_at, '-infinity'::timestamptz)
    ) THEN 'pending'
    WHEN workflow_events.validated_at > COALESCE(workflow_events.rejected_at, '-infinity'::timestamptz) THEN 'validated'
    WHEN workflow_events.rejected_at IS NOT NULL THEN 'rejected'
    ELSE 'pending'
  END
FROM workflow_events
WHERE facture.id = workflow_events.id
  AND workflow_events.submitted_at IS NOT NULL;
