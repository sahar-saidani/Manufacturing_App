import { useRef, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';

export function ImportPage() {
  const { activeCompanyId, activeCompany, refreshData } = useAppData();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [machineCode, setMachineCode] = useState('');
  const [machineName, setMachineName] = useState('');
  const [machineDescription, setMachineDescription] = useState('');
  const [productReference, setProductReference] = useState('');
  const [productName, setProductName] = useState('');
  const [productBatchSize, setProductBatchSize] = useState('1');
  const [productDemand, setProductDemand] = useState('0');
  const [productGamme, setProductGamme] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureCompany = () => {
    if (!activeCompanyId) {
      toast.error("Créez ou sélectionnez d'abord une entreprise.");
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    if (!selectedFile || !ensureCompany()) {
      return;
    }

    setUploading(true);
    try {
      const result = await apiService.importFromFile(activeCompanyId!, selectedFile);
      setUploadSuccess(true);
      toast.success(`${result.detail} Machines: ${result.imported.machines ?? 0}, Produits: ${result.imported.products ?? 0}`);
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'import.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddMachine = async () => {
    if (!ensureCompany()) {
      return;
    }
    if (!machineCode.trim() || !machineName.trim()) {
      toast.error('Code et nom machine sont obligatoires.');
      return;
    }

    try {
      await apiService.createMachine(activeCompanyId!, {
        code: machineCode.trim(),
        name: machineName.trim(),
        description: machineDescription.trim(),
      });
      toast.success(`Machine ${machineCode.trim()} ajoutée.`);
      setMachineCode('');
      setMachineName('');
      setMachineDescription('');
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout de la machine.");
    }
  };

  const handleAddProduct = async () => {
    if (!ensureCompany()) {
      return;
    }
    if (!productReference.trim() || !productName.trim()) {
      toast.error('Référence et nom produit sont obligatoires.');
      return;
    }

    const routes = productGamme
      .split(/[-,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((machineCode, index) => ({
        machine_code: machineCode,
        operation_order: index + 1,
        operation_name: `Opération ${index + 1}`,
      }));

    try {
      await apiService.createProduct(activeCompanyId!, {
        reference: productReference.trim(),
        name: productName.trim(),
        batch_size: Number(productBatchSize) || 1,
        annual_demand: Number(productDemand) || 0,
        routes,
      });
      toast.success(`Produit ${productReference.trim()} ajouté.`);
      setProductReference('');
      setProductName('');
      setProductBatchSize('1');
      setProductDemand('0');
      setProductGamme('');
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout du produit.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Import et saisie</h2>
        <p className="mt-1 text-gray-600">
          {activeCompany ? `Entreprise active: ${activeCompany.name}` : 'Sélectionnez une entreprise pour continuer.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import depuis fichier</CardTitle>
            <CardDescription>Formats supportés: `.xlsx`, `.xls`, `.csv`</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-lg border-2 border-dashed p-8 text-center ${uploadSuccess ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
              {selectedFile ? (
                <div className="flex flex-col items-center">
                  {uploadSuccess ? <CheckCircle className="mb-3 h-12 w-12 text-green-600" /> : <File className="mb-3 h-12 w-12 text-blue-600" />}
                  <p className="font-medium text-gray-700">{selectedFile.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="mb-3 h-12 w-12 text-gray-400" />
                  <p className="font-medium text-gray-700">Choisissez un fichier d'import</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
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
              <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                <File className="mr-2 h-4 w-4" />
                Parcourir
              </Button>
              <Button className="flex-1" disabled={!selectedFile || uploading} onClick={() => void handleUpload()}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Import...' : 'Importer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter une machine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="machine-code">Code</Label>
                <Input id="machine-code" value={machineCode} onChange={(event) => setMachineCode(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="machine-name">Nom</Label>
                <Input id="machine-name" value={machineName} onChange={(event) => setMachineName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="machine-description">Description</Label>
                <Textarea
                  id="machine-description"
                  value={machineDescription}
                  onChange={(event) => setMachineDescription(event.target.value)}
                />
              </div>
              <Button className="w-full" onClick={() => void handleAddMachine()}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter la machine
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajouter un produit</CardTitle>
              <CardDescription>La gamme accepte un format type `M1-M2-M3`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-reference">Référence</Label>
                <Input id="product-reference" value={productReference} onChange={(event) => setProductReference(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name">Nom</Label>
                <Input id="product-name" value={productName} onChange={(event) => setProductName(event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-batch-size">Taille de lot</Label>
                  <Input id="product-batch-size" type="number" value={productBatchSize} onChange={(event) => setProductBatchSize(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-demand">Demande annuelle</Label>
                  <Input id="product-demand" type="number" value={productDemand} onChange={(event) => setProductDemand(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-gamme">Gamme</Label>
                <Input id="product-gamme" value={productGamme} onChange={(event) => setProductGamme(event.target.value)} placeholder="M1-M2-M3" />
              </div>
              <Button className="w-full" onClick={() => void handleAddProduct()}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter le produit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Format attendu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              Le backend accepte des colonnes comme `code`, `name`, `reference`, `gamme`, `machine_code`,
              `operation_order`, `from_machine`, `to_machine`, `ul_value`. Pour un import simple produits/gammes, un
              CSV avec `reference,name,batch_size,gamme` suffit.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
