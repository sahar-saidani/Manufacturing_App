import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { Dashboard } from './pages/Dashboard';
import { GammesPage } from './pages/GammesPage';
import { MachinesPage } from './pages/MachinesPage';
import { KingAlgorithmPage } from './pages/KingAlgorithmPage';
import { FactoryFloorPage } from './pages/FactoryFloorPage';
import { ImportPage } from './pages/ImportPage';
import { KingImportPage } from './pages/KingImportPage';
import { ChainonImportPage } from './pages/ChainonImportPage';
import { ChainonPage } from './pages/ChainonPage';
import { NotFound } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'gammes', Component: GammesPage },
      { path: 'machines', Component: MachinesPage },
      { path: 'king-algorithm', Component: KingAlgorithmPage },
      { path: 'chainon', Component: ChainonPage },
      { path: 'factory-floor', Component: FactoryFloorPage },
      { path: 'import', Component: ImportPage },
      { path: 'import/king', Component: KingImportPage },
      { path: 'import/chainon', Component: ChainonImportPage },
      { path: '*', Component: NotFound }
    ]
  }
]);
