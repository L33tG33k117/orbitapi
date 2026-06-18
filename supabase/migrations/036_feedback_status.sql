-- ============================================================
-- 036 — Feedback triage workflow
-- ============================================================
-- Widen feedback.status from new/reviewed to a triage workflow:
--   new → acknowledged → actioned
-- (existing 'reviewed' rows become 'acknowledged'). Deletes are hard-deletes.

alter table public.feedback drop constraint if exists feedback_status_check;
update public.feedback set status = 'acknowledged' where status = 'reviewed';
alter table public.feedback
  add constraint feedback_status_check check (status in ('new', 'acknowledged', 'actioned'));
