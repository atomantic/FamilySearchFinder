import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/Dashboard';
import { TreeView } from './components/tree/TreeView';
import { PersonDetail } from './components/person/PersonDetail';
import { SearchPage } from './components/search/SearchPage';
import { PathFinder } from './components/path/PathFinder';
import { IndexerPage } from './components/indexer/IndexerPage';
import { AIProvidersPage } from './pages/AIProviders';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tree/:dbId" element={<TreeView />} />
        <Route path="tree/:dbId/:personId" element={<TreeView />} />
        <Route path="person/:dbId/:personId" element={<PersonDetail />} />
        <Route path="search/:dbId" element={<SearchPage />} />
        <Route path="path/:dbId" element={<PathFinder />} />
        <Route path="indexer" element={<IndexerPage />} />
        <Route path="providers" element={<AIProvidersPage />} />
      </Route>
    </Routes>
  );
}

export default App;
