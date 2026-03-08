-- ═══════════════════════════════════════════
-- STORAGE : Bucket pour les PDFs de décisions
-- ═══════════════════════════════════════════

-- Créer le bucket pour les PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'decisions-pdfs',
  'decisions-pdfs',
  FALSE,
  52428800, -- 50MB max
  ARRAY['application/pdf']
);

-- ═══════════════════════════════════════════
-- STORAGE RLS : Politiques d'accès au bucket
-- ═══════════════════════════════════════════

-- Upload : les utilisateurs authentifiés peuvent uploader dans le dossier de leur cabinet
CREATE POLICY "Upload PDF par membre du cabinet"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'decisions-pdfs'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Download : les membres du cabinet peuvent télécharger leurs PDFs
CREATE POLICY "Download PDF par membre du cabinet"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'decisions-pdfs'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Delete : les membres du cabinet peuvent supprimer leurs PDFs
CREATE POLICY "Delete PDF par membre du cabinet"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'decisions-pdfs'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);
