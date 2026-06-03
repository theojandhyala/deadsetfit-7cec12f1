DROP POLICY IF EXISTS "Users manage their own blocks" ON public.user_blocks;
CREATE POLICY "Users manage their own blocks" ON public.user_blocks
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);