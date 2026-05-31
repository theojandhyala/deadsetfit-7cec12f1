CREATE TABLE public.user_state (
  user_id UUID NOT NULL PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_state TO authenticated;
GRANT ALL ON public.user_state TO service_role;

ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own state" ON public.user_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own state" ON public.user_state
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own state" ON public.user_state
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users delete own state" ON public.user_state
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_state_set_updated_at
  BEFORE UPDATE ON public.user_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();