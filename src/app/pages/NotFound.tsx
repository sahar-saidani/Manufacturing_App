import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Page non trouvée</h2>
      <p className="text-gray-600 mb-6">La page que vous recherchez n'existe pas.</p>
      <Link to="/">
        <Button>Retour au tableau de bord</Button>
      </Link>
    </div>
  );
}
