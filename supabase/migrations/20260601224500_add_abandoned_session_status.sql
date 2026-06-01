-- Track sessions the user intentionally discarded or replaced.
-- These are not evaluated and should not count as completed practice.

alter type public.session_status add value if not exists 'abandoned';
