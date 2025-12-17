
import React, { useState, useEffect, useMemo } from 'react';
import { Specimen, Annotation } from './types';
import SpecimenCard from './components/SpecimenCard';
import SpecimenForm from './components/SpecimenForm';
import SpecimenDetail from './components/SpecimenDetail';
import Button from './components/Button';
import { DatabaseService } from './services/databaseService';

const App: React.FC = () => {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'gallery' | 'add' | 'detail'>('gallery');
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load specimens from "database" on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await DatabaseService.getAllSpecimens();
      setSpecimens(data);
    } catch (error) {
      console.error("Failed to load specimens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSpecimens = useMemo(() => {
    return specimens.filter(s => 
      s.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.collector.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [specimens, searchQuery]);

  const activeSpecimen = useMemo(() => {
    return specimens.find(s => s.id === selectedSpecimenId);
  }, [specimens, selectedSpecimenId]);

  const handleAddSpecimen = async (data: any) => {
    const newSpecimen: Specimen = {
      id: `specimen_${Date.now()}`,
      scientificName: data.scientificName || 'Unknown',
      family: data.family || 'Unknown',
      genus: data.genus || '',
      collector: data.collector || 'Anonymous',
      collectionDate: data.collectionDate || new Date().toISOString().split('T')[0],
      locality: {
        country: data.country || '',
        stateProvince: data.stateProvince || '',
        countyCity: data.countyCity || '',
        description: data.localityDescription || 'No description',
        latitude: parseFloat(data.latitude) || undefined,
        longitude: parseFloat(data.longitude) || undefined,
        habitat: data.habitat || ''
      },
      imageUrl: data.imageUrl, // Image URL stored as data in SQL
      description: data.description || '',
      annotations: [],
      tags: []
    };

    // UI Optimistic Update
    setSpecimens(prev => [newSpecimen, ...prev]);
    setView('gallery');

    // Persistence in DB
    try {
      await DatabaseService.saveSpecimen(newSpecimen);
    } catch (error) {
      console.error("Database save failed:", error);
      alert("Failed to save to database. Check connection.");
      loadData(); // Revert to server state
    }
  };

  const handleAddAnnotation = async (specimenId: string, annotation: Annotation) => {
    // UI Update
    setSpecimens(prev => prev.map(s => 
      s.id === specimenId 
        ? { ...s, annotations: [annotation, ...s.annotations] } 
        : s
    ));

    // Persistence in DB
    try {
      await DatabaseService.addAnnotation(specimenId, annotation);
    } catch (error) {
      console.error("Failed to save annotation:", error);
    }
  };

  const handleDeleteSpecimen = async (id: string) => {
    if (!confirm("Are you sure you want to delete this specimen from the database?")) return;
    
    // UI Update
    setSpecimens(prev => prev.filter(s => s.id !== id));
    setView('gallery');

    // Persistence
    try {
      await DatabaseService.deleteSpecimen(id);
    } catch (error) {
      console.error("Delete failed:", error);
      loadData();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('gallery')}>
            <div className="bg-emerald-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Herbarium <span className="text-emerald-600">Pro</span></h1>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="Search database..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={() => setView('add')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Specimen</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Connecting to specimen database...</p>
          </div>
        ) : (
          <>
            {view === 'gallery' && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 serif">Digital Collection</h2>
                    <p className="text-slate-500 mt-1">Found {filteredSpecimens.length} curated specimens</p>
                  </div>
                </div>

                {filteredSpecimens.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSpecimens.map(s => (
                      <SpecimenCard 
                        key={s.id} 
                        specimen={s} 
                        onClick={(id) => {
                          setSelectedSpecimenId(id);
                          setView('detail');
                        }} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-600">Database Empty</h3>
                    <p className="text-slate-400 mt-2">Add your first specimen to start the digital herbarium.</p>
                    <Button variant="outline" className="mx-auto mt-6" onClick={() => setView('add')}>
                      Register New Specimen
                    </Button>
                  </div>
                )}
              </div>
            )}

            {view === 'add' && (
              <SpecimenForm 
                onSubmit={handleAddSpecimen} 
                onCancel={() => setView('gallery')} 
              />
            )}

            {view === 'detail' && activeSpecimen && (
              <SpecimenDetail 
                specimen={activeSpecimen} 
                onBack={() => setView('gallery')}
                onAddAnnotation={handleAddAnnotation}
                onDelete={() => handleDeleteSpecimen(activeSpecimen.id)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs">
          <p>© 2024 Herbarium Pro • Connected to MySQL Specimen Database</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-emerald-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Relational Schema</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">API v1.0</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
