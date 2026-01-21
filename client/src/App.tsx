import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/Dashboard';
import { AncestryTreeView } from './components/ancestry-tree';
import { PersonDetail } from './components/person/PersonDetail';
import { SearchPage } from './components/search/SearchPage';
import { PathFinder } from './components/path/PathFinder';
import { IndexerPage } from './components/indexer/IndexerPage';
import { AIProvidersPage } from './pages/AIProviders';
import { GenealogyProvidersPage } from './pages/GenealogyProviders';
import { GenealogyProviderEditPage } from './pages/GenealogyProviderEdit';
import { FavoritesPage } from './components/favorites/FavoritesPage';
import { SparseTreePage } from './components/favorites/SparseTreePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tree/:dbId" element={<AncestryTreeView />} />
        <Route path="tree/:dbId/:personId" element={<AncestryTreeView />} />
        <Route path="person/:dbId/:personId" element={<PersonDetail />} />
        <Route path="search/:dbId" element={<SearchPage />} />
        <Route path="path/:dbId" element={<PathFinder />} />
        <Route path="indexer" element={<IndexerPage />} />
        <Route path="providers" element={<AIProvidersPage />} />
        <Route path="providers/genealogy" element={<GenealogyProvidersPage />} />
        <Route path="providers/genealogy/new" element={<GenealogyProviderEditPage />} />
        <Route path="providers/genealogy/:id/edit" element={<GenealogyProviderEditPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="favorites/sparse-tree/:dbId" element={<SparseTreePage />} />
      </Route>
    </Routes>
  );
}

export default App;
