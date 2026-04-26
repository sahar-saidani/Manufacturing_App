import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { AlgorithmImportPanel } from '../components/AlgorithmImportPanel';
import { Button } from '../components/ui/button';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';

export function ChainonImportPage() {
  const { activeCompanyId, activeCompany, refreshData } = useAppData();

  const ensureCompany = () => {
    if (!activeCompanyId) {
      toast.error("Créez ou sélectionnez d'abord une entreprise.");
      return false;
    }
    return true;
  };

  const importChainonFile = async (file: File) => {
    if (!ensureCompany()) {
      throw new Error('Aucune entreprise active.');
    }
    const result = await apiService.importChainonFromFile(activeCompanyId!, file);
    await refreshData();
    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dépôt Excel pour l'algorithme de Chainon</h2>
          <p className="mt-1 text-gray-600">
            {activeCompany ? `Entreprise active: ${activeCompany.name}` : 'Sélectionnez une entreprise pour continuer.'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/import">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux dépôts
          </Link>
        </Button>
      </div>

      <AlgorithmImportPanel
        title="Importer un fichier Excel Chainon"
        description="Déposez ici le fichier Excel ou CSV réservé au flux Chainon."
        emptyLabel="Choisissez un fichier pour Chainon"
        helperText="Formats supportés: .xlsx, .xls, .csv. Ce dépôt est séparé de King pour éviter de mélanger les jeux de données. Le backend a maintenant un endpoint dédié Chainon."
        importAction={importChainonFile}
      />
    </div>
  );
}
