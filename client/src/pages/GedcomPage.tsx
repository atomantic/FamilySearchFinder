import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Users,
  Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import type { DatabaseInfo } from '@fsf/shared';

interface PreviewData {
  header: {
    source?: string;
    version?: string;
    charset?: string;
  };
  individualCount: number;
  familyCount: number;
  sampleIndividuals: Array<{
    id: string;
    name: string;
    birthDate?: string;
    deathDate?: string;
  }>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function GedcomPage() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  // Import state
  const [, setImportFile] = useState<File | null>(null);
  const [importContent, setImportContent] = useState<string>('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);

  // Export state
  const [selectedDbForExport, setSelectedDbForExport] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load databases for export
  const loadDatabases = async () => {
    if (databases.length > 0) return;

    setLoadingDatabases(true);
    const dbs = await api.listDatabases().catch(() => []);
    setDatabases(dbs);
    setLoadingDatabases(false);
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setValidation(null);
    setPreview(null);

    // Read file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setImportContent(content);

      // Auto-generate name from filename
      const baseName = file.name.replace(/\.ged$/i, '').replace(/[^a-zA-Z0-9]/g, '-');
      setImportName(baseName);

      // Validate
      await validateAndPreview(content);
    };
    reader.readAsText(file);
  };

  // Validate and preview
  const validateAndPreview = async (content: string) => {
    setValidating(true);

    // Validate
    const validationResult = await api.validateGedcom(content)
      .catch(err => ({ valid: false, errors: [err.message] }));

    setValidation(validationResult);

    // Get preview if valid
    if (validationResult.valid) {
      const previewResult = await api.previewGedcom(content).catch(() => null);
      setPreview(previewResult);
    }

    setValidating(false);
  };

  // Import GEDCOM
  const handleImport = async () => {
    if (!importContent || !importName.trim()) {
      toast.error('Please select a file and enter a database name');
      return;
    }

    if (!validation?.valid) {
      toast.error('Please fix validation errors before importing');
      return;
    }

    setImporting(true);

    const result = await api.importGedcom(importContent, importName.trim())
      .catch(err => ({ error: err.message }));

    setImporting(false);

    if ('error' in result) {
      toast.error(`Import failed: ${result.error}`);
      return;
    }

    toast.success(`Imported ${result.personCount} people into database ${result.dbId}`);

    // Reset form
    setImportFile(null);
    setImportContent('');
    setValidation(null);
    setPreview(null);
    setImportName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export GEDCOM
  const handleExport = async () => {
    if (!selectedDbForExport) {
      toast.error('Please select a database to export');
      return;
    }

    setExporting(true);

    // Download directly
    window.location.href = api.getGedcomExportUrl(selectedDbForExport);

    toast.success('Download started');
    setExporting(false);
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-app-accent" />
        <h1 className="text-2xl font-bold text-app-text">GEDCOM Import/Export</h1>
      </div>

      {/* Info */}
      <div className="bg-app-card border border-app-border rounded-lg p-4 mb-6">
        <p className="text-app-text-muted text-sm">
          GEDCOM (GEnealogical Data COMmunication) is a standard format for exchanging genealogical data
          between different software and services. Use this page to import family trees from other programs
          or export your data for use elsewhere.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="bg-app-card border border-app-border rounded-lg p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
            <Upload size={18} />
            Import GEDCOM
          </h2>

          {/* File upload */}
          <div className="mb-4">
            <label className="block text-sm text-app-text-muted mb-2">Select GEDCOM File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.gedcom"
              onChange={handleFileSelect}
              className="w-full text-sm text-app-text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-app-accent file:text-app-text hover:file:bg-app-accent/80 cursor-pointer"
            />
          </div>

          {/* Validation status */}
          {validating && (
            <div className="flex items-center gap-2 text-app-text-muted mb-4">
              <Loader2 size={16} className="animate-spin" />
              Validating...
            </div>
          )}

          {validation && (
            <div className={`p-3 rounded mb-4 ${
              validation.valid
                ? 'bg-green-600/10 border border-green-600/30'
                : 'bg-red-600/10 border border-red-600/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {validation.valid ? (
                  <CheckCircle2 size={16} className="text-green-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
                <span className={validation.valid ? 'text-green-400' : 'text-red-400'}>
                  {validation.valid ? 'Valid GEDCOM file' : 'Validation failed'}
                </span>
              </div>
              {validation.errors.length > 0 && (
                <ul className="text-sm text-red-400 mt-2 space-y-1">
                  {validation.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                      {err}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-app-bg/50 rounded p-3 mb-4">
              <h4 className="text-sm font-medium text-app-text-secondary mb-2">Preview</h4>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="flex items-center gap-2 text-app-text-muted">
                  <Users size={14} />
                  <span>{preview.individualCount} individuals</span>
                </div>
                <div className="flex items-center gap-2 text-app-text-muted">
                  <Home size={14} />
                  <span>{preview.familyCount} families</span>
                </div>
              </div>
              {preview.sampleIndividuals.length > 0 && (
                <>
                  <p className="text-xs text-app-text-subtle mb-1">Sample individuals:</p>
                  <ul className="text-xs text-app-text-muted space-y-0.5">
                    {preview.sampleIndividuals.slice(0, 5).map(p => (
                      <li key={p.id}>
                        {p.name}
                        {p.birthDate && ` (b. ${p.birthDate})`}
                        {p.deathDate && ` - d. ${p.deathDate}`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Database name */}
          {validation?.valid && (
            <div className="mb-4">
              <label className="block text-sm text-app-text-muted mb-2">Database Name</label>
              <input
                type="text"
                value={importName}
                onChange={e => setImportName(e.target.value)}
                placeholder="my-family-tree"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none"
              />
              <p className="text-xs text-app-text-subtle mt-1">
                Will be saved as db-{importName.toLowerCase().replace(/[^a-z0-9]/g, '-') || '...'}.json
              </p>
            </div>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={importing || !validation?.valid || !importName.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-app-accent text-app-text rounded hover:bg-app-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import GEDCOM
              </>
            )}
          </button>
        </div>

        {/* Export Section */}
        <div className="bg-app-card border border-app-border rounded-lg p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
            <Download size={18} />
            Export GEDCOM
          </h2>

          {/* Database selector */}
          <div className="mb-4">
            <label className="block text-sm text-app-text-muted mb-2">Select Database</label>
            <select
              value={selectedDbForExport}
              onChange={e => setSelectedDbForExport(e.target.value)}
              onFocus={loadDatabases}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
            >
              <option value="">Select a database...</option>
              {loadingDatabases ? (
                <option disabled>Loading...</option>
              ) : (
                databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.rootName || db.id} ({db.personCount} people)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Export info */}
          <div className="bg-app-bg/50 rounded p-3 mb-4">
            <p className="text-sm text-app-text-muted">
              Exports your database in GEDCOM 5.5.1 format, compatible with most genealogy software including:
            </p>
            <ul className="text-xs text-app-text-subtle mt-2 space-y-1">
              <li>Ancestry.com</li>
              <li>FamilySearch</li>
              <li>MyHeritage</li>
              <li>Gramps</li>
              <li>Legacy Family Tree</li>
            </ul>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || !selectedDbForExport}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-app-accent text-app-text rounded hover:bg-app-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export GEDCOM
              </>
            )}
          </button>
        </div>
      </div>

      {/* Link back */}
      <div className="mt-6">
        <Link
          to="/"
          className="text-app-accent hover:underline text-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
