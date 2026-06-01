-- Allow zero-evidence evaluations to store 0/5 rubric scores.
-- This is needed for non-answers such as "asd" where there is no fair rubric
-- evidence to score.

alter table public.rubric_scores
  drop constraint if exists rubric_scores_score_check;

alter table public.rubric_scores
  add constraint rubric_scores_score_check
  check (score between 0 and 5);
