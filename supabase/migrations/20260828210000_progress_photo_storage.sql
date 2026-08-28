-- Progress photos out of the state blob and into object storage.
--
-- Check-in photos were stored as base64 data URLs inside `user_state.data`,
-- which the sync path caps at 2,000,000 bytes to match the server. A single
-- stored photo measures ~122 KB for an ordinary shot and ~640 KB for a noisy
-- one, so between three and sixteen check-ins fill the entire payload on their
-- own — before a single workout is counted. Past the cap the client stops
-- pushing and cloud backup of ALL training data silently pauses.
--
-- Private bucket: these are photographs of people's bodies. Reads go through
-- short-lived signed URLs, never a public path.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  FALSE,
  10485760, -- 10 MB; the client downscales to ~150 KB, this is only a backstop
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Every object lives under a folder named for its owner's user id, and each
-- policy checks that first path segment against the caller. A user can never
-- name a path into somebody else's folder.

DROP POLICY IF EXISTS "progress photos read own" ON storage.objects;
CREATE POLICY "progress photos read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress photos insert own" ON storage.objects;
CREATE POLICY "progress photos insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress photos update own" ON storage.objects;
CREATE POLICY "progress photos update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress photos delete own" ON storage.objects;
CREATE POLICY "progress photos delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
