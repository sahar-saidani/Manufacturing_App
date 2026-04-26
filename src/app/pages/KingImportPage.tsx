import { Link } from 'react-router';
import { useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { AlgorithmImportPanel } from '../components/AlgorithmImportPanel';
import { MatrixTable } from '../components/csp/MatrixTable';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';
import type { MatrixPreview } from '../types';

export function KingImportPage() {
  const { activeCompanyId, activeCompany, refreshData } = useAppData();
  const [importPreview, setImportPreview] = useState<MatrixPreview | null>(null);

  const ensureCompany = () => {
    if (!activeCompanyId) {
      toast.error("Creez ou selectionnez d'abord une entreprise.");
      return false;
    }
    return true;
  };

  const importKingFile = async (file: File) => {
    if (!ensureCompany()) {
      throw new Error('Aucune entreprise active.');
    }
    const result = await apiService.importKingFromFile(activeCompanyId, file);
    setImportPreview(result.preview);
    await refreshData();
    return result;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#4f8ef7]/10 px-3 py-1 text-xs font-medium text-[#a3c0ff]">
              <Upload className="h-3.5 w-3.5" />
              Import King
            </div>
            <h2 className="text-xl font-semibold text-white">Importer une matrice produit x machine</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9299b0]">
              Premiere colonne = produits, colonnes suivantes = machines, contenu strictement binaire 0/1.
              {activeCompany ? ` Entreprise active: ${activeCompany.name}.` : ' Selectionnez une entreprise avant import.'}
            </p>
          </div>
          <Link
            to="/import"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#363e55] bg-[#0d0f14] px-4 text-sm font-medium text-[#e8eaf2] transition hover:border-[#4f8ef7] hover:text-[#4f8ef7]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <AlgorithmImportPanel
          title="Importer un fichier King"
          description="Charge la matrice, conserve les vrais libelles du fichier et prepare l'execution de la methode King."
          emptyLabel="Choisissez un fichier Excel ou CSV"
          helperText="Formats supportes: .xlsx, .xls, .csv. Le contenu affiche ci-dessous correspond exactement a la matrice lue par le backend."
          importAction={importKingFile}
        />
      </section>

      {importPreview ? (
        <MatrixTable
          title={`Matrice importee (${importPreview.product_references.length} produits x ${importPreview.machine_codes.length} machines)`}
          rowLabels={importPreview.product_references}
          columnLabels={importPreview.machine_codes}
          data={importPreview.matrix}
        />
      ) : null}
    </div>
  );
}
