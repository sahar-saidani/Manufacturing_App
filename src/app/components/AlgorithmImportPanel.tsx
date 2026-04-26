import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { KingImportResponse } from '../types';

type AlgorithmImportPanelProps = {
  title: string;
  description: string;
  emptyLabel: string;
  helperText: string;
  importAction: (file: File) => Promise<KingImportResponse>;
};

export function AlgorithmImportPanel({
  title,
  description,
  emptyLabel,
  helperText,
  importAction,
}: AlgorithmImportPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    try {
      const result = await importAction(selectedFile);
      setUploadSuccess(true);
      toast.success(
        `${result.detail} Machines: ${result.imported.machines ?? 0}, Produits: ${result.imported.products ?? 0}, Routes: ${result.imported.routes ?? 0}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'import.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#9299b0]">{description}</p>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          uploadSuccess
            ? 'border-emerald-400/40 bg-emerald-500/10'
            : 'border-[#363e55] bg-[#0d0f14] hover:border-[#4f8ef7]/50'
        }`}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center">
            {uploadSuccess ? (
              <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-400" />
            ) : (
              <FileSpreadsheet className="mb-3 h-12 w-12 text-[#4f8ef7]" />
            )}
            <p className="font-medium text-white">{selectedFile.name}</p>
            <p className="mt-1 text-sm text-[#9299b0]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="mb-3 h-12 w-12 text-[#636980]" />
            <p className="font-medium text-white">{emptyLabel}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] || null);
            setUploadSuccess(false);
          }}
        />

        <button
          type="button"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#363e55] bg-[#0d0f14] px-4 text-sm font-medium text-[#e8eaf2] transition hover:border-[#4f8ef7] hover:text-[#4f8ef7]"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Parcourir
        </button>

        <button
          type="button"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f8ef7] to-[#7c5cfc] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!selectedFile || uploading}
          onClick={() => void handleUpload()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Import...' : 'Importer'}
        </button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
        <div>{helperText}</div>
      </div>
    </div>
  );
}
