'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Trash2, Upload } from 'lucide-react';

import { buildUploadPath, deleteDocument, getDocumentUrl, registerDocument } from '@/app/portal/actions';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { SUPABASE_BUCKET } from '@/lib/supabase/config';
import { ACCEPTED_DOCUMENT_EXTENSIONS, ACCEPTED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/constants';
import { cn, formatBytes, formatDateTime } from '@/lib/utils';
import type { ApplicationDocument, DocumentType } from '@/lib/types';

type UploadState =
  | { phase: 'idle' }
  | { phase: 'validating' }
  | { phase: 'uploading'; fileName: string }
  | { phase: 'recording'; fileName: string }
  | { phase: 'error'; fileName: string; message: string; file: File };

const ACCEPT_ATTRIBUTE = ACCEPTED_DOCUMENT_EXTENSIONS.join(',');

function validate(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number])) {
    return `${file.name} is not an accepted file type. Upload a PDF, Word document, JPG, PNG or WebP file.`;
  }
  if (file.size > maxBytes) {
    return `${file.name} is ${formatBytes(file.size)}, which is larger than the ${formatBytes(maxBytes)} limit.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty. Please choose a different file.`;
  }
  return null;
}

/**
 * Document upload panel.
 *
 * Files go straight from the browser into the private storage bucket, where
 * storage policies only allow writes inside the signed-in applicant's own
 * folder. The metadata row is then recorded through a server action that
 * re-checks ownership. Viewing uses short-lived signed URLs — the bucket is
 * never public.
 *
 * A failed upload keeps the file in the browser so the applicant can retry
 * without re-selecting it.
 */
export function DocumentUploader({
  applicationId,
  documentTypes,
  documents,
  editable,
  onUploaded,
}: {
  applicationId: string;
  documentTypes: DocumentType[];
  documents: ApplicationDocument[];
  editable: boolean;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const busy = upload.phase === 'uploading' || upload.phase === 'recording';

  async function performUpload(file: File, documentType: DocumentType | null) {
    const maxBytes = Math.min(MAX_DOCUMENT_BYTES, (documentType?.max_size_mb ?? 5) * 1024 * 1024);

    setUpload({ phase: 'validating' });
    const invalid = validate(file, maxBytes);
    if (invalid) {
      setUpload({ phase: 'error', fileName: file.name, message: invalid, file });
      return;
    }

    setUpload({ phase: 'uploading', fileName: file.name });

    const pathResult = await buildUploadPath({
      applicationId,
      documentCode: documentType?.code ?? 'SUPPORTING_FILE',
      fileName: file.name,
    });

    if (!pathResult.ok) {
      setUpload({ phase: 'error', fileName: file.name, message: pathResult.error, file });
      return;
    }

    let storage;
    try {
      storage = getBrowserSupabase();
    } catch {
      setUpload({
        phase: 'error',
        fileName: file.name,
        message: 'Uploads are unavailable because the storage service is not configured.',
        file,
      });
      return;
    }

    const { error: uploadError } = await storage.storage
      .from(SUPABASE_BUCKET)
      .upload(pathResult.data.path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setUpload({
        phase: 'error',
        fileName: file.name,
        message: 'Unable to upload document. Please try again.',
        file,
      });
      return;
    }

    setUpload({ phase: 'recording', fileName: file.name });

    const recorded = await registerDocument({
      applicationId,
      documentTypeId: documentType?.id ?? null,
      storagePath: pathResult.data.path,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    });

    if (!recorded.ok) {
      setUpload({ phase: 'error', fileName: file.name, message: recorded.error, file });
      return;
    }

    setUpload({ phase: 'idle' });
    onUploaded?.();
    router.refresh();
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>, documentType: DocumentType | null) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void performUpload(file, documentType);
  }

  async function handleView(id: string) {
    setRowError(null);
    setBusyId(id);
    const result = await getDocumentUrl(id);
    setBusyId(null);

    if (!result.ok) {
      setRowError(result.error);
      return;
    }
    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(id: string) {
    setRowError(null);
    setBusyId(id);
    const result = await deleteDocument(id);
    setBusyId(null);

    if (!result.ok) {
      setRowError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {upload.phase === 'error' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm text-red-900">{upload.message}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void performUpload(upload.file, null)}
            className="shrink-0"
          >
            Retry upload
          </Button>
        </div>
      ) : null}

      {busy ? (
        <div
          aria-live="polite"
          className="flex items-center gap-3 rounded-md border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-900"
        >
          <Spinner className="size-4" />
          {upload.phase === 'uploading'
            ? `Uploading ${upload.fileName}…`
            : `Saving the record for ${upload.fileName}…`}
        </div>
      ) : null}

      {rowError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {rowError}
        </p>
      ) : null}

      <div className="space-y-3">
        {documentTypes.map((type) => {
          const files = documents.filter((document) => document.document_type_id === type.id);
          const inputId = `upload-${type.code}`;

          return (
            <div key={type.code} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900">
                    {type.name}
                    <span className="ml-2 text-xs font-medium text-slate-500">Optional</span>
                  </p>
                  {type.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{type.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">
                    PDF, Word, JPG, PNG or WebP · up to {type.max_size_mb} MB
                  </p>
                </div>

                {editable ? (
                  <>
                    <input
                      ref={(node) => {
                        inputRefs.current[type.code] = node;
                      }}
                      id={inputId}
                      type="file"
                      accept={ACCEPT_ATTRIBUTE}
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => handleFileInput(event, type)}
                    />
                    <label
                      htmlFor={inputId}
                      className={cn(
                        'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-navy-900 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50',
                        busy && 'pointer-events-none opacity-60'
                      )}
                    >
                      <Upload aria-hidden="true" className="size-4" />
                      {files.length > 0 ? 'Add another' : 'Upload file'}
                    </label>
                  </>
                ) : null}
              </div>

              {files.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                  {files.map((document) => (
                    <li key={document.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <FileText aria-hidden="true" className="size-4 shrink-0 text-navy-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-navy-900">{document.file_name}</span>
                        <span className="block text-xs text-slate-500">
                          {formatBytes(document.file_size)} · uploaded {formatDateTime(document.uploaded_at)}
                          {document.review_status !== 'PENDING'
                            ? ` · ${document.review_status.toLowerCase()}`
                            : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleView(document.id)}
                        disabled={busyId === document.id}
                        className="text-xs font-semibold text-navy-800 hover:underline disabled:opacity-50"
                      >
                        <Download aria-hidden="true" className="mr-1 inline size-3.5" />
                        View
                      </button>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(document.id)}
                          disabled={busyId === document.id}
                          className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                        >
                          <Trash2 aria-hidden="true" className="mr-1 inline size-3.5" />
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents uploaded"
          description="Documents are optional at this stage. The review team will ask for anything specific if it is needed."
        />
      ) : null}
    </div>
  );
}
