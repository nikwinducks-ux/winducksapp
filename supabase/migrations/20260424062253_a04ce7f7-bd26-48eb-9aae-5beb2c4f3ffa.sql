-- Add trigger to send push notifications when an SP is added to a job crew (i.e., assigned)
CREATE OR REPLACE TRIGGER trg_notify_crew_assignment_push
  AFTER INSERT ON public.job_crew_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_offer_push();