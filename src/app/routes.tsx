import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { Dashboard } from './pages/Dashboard';
import { GammesPage } from './pages/GammesPage';
import { MachinesPage } from './pages/MachinesPage';
import { KingAlgorithmPage } from './pages/KingAlgorithmPage';
import { FactoryFloorPage } from './pages/FactoryFloorPage';
import { ImportPage } from './pages/ImportPage';
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
      { path: 'factory-floor', Component: FactoryFloorPage },
      { path: 'import', Component: ImportPage },
      { path: '*', Component: NotFound }
    ]
  }
]);
