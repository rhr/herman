
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Specimen, Annotation, Pile, HistoryEntry, ActionType } from './types';
import SpecimenCard from './components/SpecimenCard';
import SpecimenForm from './components/SpecimenForm';
import SpecimenDetail from './components/SpecimenDetail';
import SpecimenTable, { ColumnId } from './components/SpecimenTable';
import PileSidebar from './components/PileSidebar';
import ActionHistory from './components/ActionHistory';
import Button from './components/Button';
import MapView from './components/MapView';
import SpecimenMapCard from './components/SpecimenMapCard';
import { DatabaseService } from './services/databaseService';

const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'specimen', label: 'Specimen Info' },
  { id: 'family', label: 'Family' },
  { id: 'genus', label: 'Genus' },
  { id: 'locality', label: 'Locality' },
  { id: 'habitat', label: 'Habitat' },
  { id: 'collector', label: 'Collector' },
  { id: 'date', label: 'Date' },
  { id: 'id', label: 'Database ID' },
];

const App: React.FC = () => {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [piles, setPiles] = useState<Pile[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activePileId, setActivePileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'gallery' | 'add' | 'detail' | 'edit'>('gallery');
  const [layout, setLayout] = useState<'grid' | 'table' | 'map'>('grid');
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(['specimen', 'family', 'locality', 'collector', 'date']);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Load specimens and piles from "database" on mount
  useEffect(() => {
    loadData();
  }, []);

  // Keyboard shortcut for Undo (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  // Close column picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [specimenData, pileData] = await Promise.all([
        DatabaseService.getAllSpecimens(),
        DatabaseService.getAllPiles()
      ]);
      setSpecimens(specimenData);
      setPiles(pileData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const pushHistory = (type: ActionType, description: string, data: any) => {
    const entry: HistoryEntry = {
      id: `hist_${Date.now()}`,
      type,
      description,
      timestamp: Date.now(),
      data
    };
    setHistory(prev => [entry, ...prev].slice(0, 50)); // Keep last 50 actions
  };

  const handleUndo = async () => {
    if (history.length === 0) return;

    const [lastAction, ...remainingHistory] = history;
    setHistory(remainingHistory);

    try {
      switch (lastAction.type) {
        case 'ADD_SPECIMEN':
          setSpecimens(prev => prev.filter(s => s.id !== lastAction.data.id));
          await DatabaseService.deleteSpecimen(lastAction.data.id);
          break;

        case 'DELETE_SPECIMEN':
          setSpecimens(prev => [lastAction.data.specimen, ...prev]);
          await DatabaseService.saveSpecimen(lastAction.data.specimen);
          break;

        case 'UPDATE_SPECIMEN':
          // Data contains previousState
          setSpecimens(prev => prev.map(s => 
            s.id === lastAction.data.previousState.id ? lastAction.data.previousState : s
          ));
          await DatabaseService.updateSpecimen(lastAction.data.previousState);
          break;

        case 'ADD_PILE':
          setPiles(prev => prev.filter(p => p.id !== lastAction.data.id));
          await DatabaseService.deletePile(lastAction.data.id);
          break;

        case 'DELETE_PILE':
          setPiles(prev => [lastAction.data.pile, ...prev]);
          await DatabaseService.savePile(lastAction.data.pile);
          break;

        case 'ADD_TO_PILE':
          setPiles(prev => prev.map(p => 
            p.id === lastAction.data.pileId 
              ? { ...p, specimenIds: p.specimenIds.filter(id => id !== lastAction.data.specimenId) } 
              : p
          ));
          await DatabaseService.removeSpecimenFromPile(lastAction.data.pileId, lastAction.data.specimenId);
          break;

        case 'REMOVE_FROM_PILE':
          setPiles(prev => prev.map(p => 
            p.id === lastAction.data.pileId 
              ? { ...p, specimenIds: [...p.specimenIds, lastAction.data.specimenId] } 
              : p
          ));
          await DatabaseService.addSpecimenToPile(lastAction.data.pileId, lastAction.data.specimenId);
          break;

        case 'ADD_ANNOTATION':
          setSpecimens(prev => prev.map(s => 
            s.id === lastAction.data.specimenId 
              ? { ...s, annotations: s.annotations.filter(a => a.id !== lastAction.data.annotationId) } 
              : s
          ));
          break;
      }
    } catch (err) {
      console.error("Undo failed:", err);
      loadData(); // Resync on error
    }
  };

  const activePile = useMemo(() => piles.find(p => p.id === activePileId), [piles, activePileId]);

  const filteredSpecimens = useMemo(() => {
    let base = specimens;
    if (activePileId) {
      const targetPile = piles.find(p => p.id === activePileId);
      if (targetPile) {
        base = specimens.filter(s => targetPile.specimenIds.includes(s.id));
      }
    }
    
    return base.filter(s => 
      s.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.collector.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [specimens, searchQuery, activePileId, piles]);

  const activeSpecimen = useMemo(() => {
    return specimens.find(s => s.id === selectedSpecimenId);
  }, [specimens, selectedSpecimenId]);

  const handleSaveSpecimen = async (data: any, id?: string) => {
    const isEditing = !!id;
    const existingSpecimen = isEditing ? specimens.find(s => s.id === id) : null;

    const specimenData: Specimen = {
      id: id || `specimen_${Date.now()}`,
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
      imageUrls: data.imageUrls || [],
      description: data.description || '',
      microhabitat: data.microhabitat || '',
      annotations: existingSpecimen?.annotations || [],
      tags: existingSpecimen?.tags || []
    };

    if (isEditing) {
      setSpecimens(prev => prev.map(s => s.id === id ? specimenData : s));
      pushHistory('UPDATE_SPECIMEN', `Updated specimen: ${specimenData.scientificName}`, { 
        previousState: existingSpecimen,
        newState: specimenData 
      });
      setView('detail');
    } else {
      setSpecimens(prev => [specimenData, ...prev]);
      pushHistory('ADD_SPECIMEN', `Registered specimen: ${specimenData.scientificName}`, { id: specimenData.id });
      setView('gallery');
    }

    try {
      if (isEditing) {
        await DatabaseService.updateSpecimen(specimenData);
      } else {
        await DatabaseService.saveSpecimen(specimenData);
      }
    } catch (error) {
      console.error("Database save failed:", error);
      alert("Failed to save to database. Check connection.");
      loadData();
    }
  };

  const handleCreatePile = async (name: string, description: string) => {
    const newPile: Pile = {
      id: `pile_${Date.now()}`,
      name,
      description,
      specimenIds: [],
      createdAt: Date.now()
    };
    setPiles(prev => [newPile, ...prev]);
    pushHistory('ADD_PILE', `Created pile: ${name}`, { id: newPile.id });
    await DatabaseService.savePile(newPile);
  };

  const handleDeletePile = async (id: string) => {
    const pileToDelete = piles.find(p => p.id === id);
    if (!pileToDelete) return;
    if (!confirm("Delete this pile? Specimens will not be deleted.")) return;

    setPiles(prev => prev.filter(p => p.id !== id));
    pushHistory('DELETE_PILE', `Deleted pile: ${pileToDelete.name}`, { pile: pileToDelete });
    
    if (activePileId === id) setActivePileId(null);
    await DatabaseService.deletePile(id);
  };

  const handleAddSpecimenToPile = async (pileId: string, specimenId: string) => {
    const pile = piles.find(p => p.id === pileId);
    const specimen = specimens.find(s => s.id === specimenId);
    if (!pile || !specimen || pile.specimenIds.includes(specimenId)) return;

    const updatedPiles = piles.map(p => {
      if (p.id === pileId) {
        return {
          ...p,
          specimenIds: [...p.specimenIds, specimenId]
        };
      }
      return p;
    });

    setPiles(updatedPiles);
    pushHistory('ADD_TO_PILE', `Added ${specimen.scientificName} to ${pile.name}`, { pileId, specimenId });
    await DatabaseService.addSpecimenToPile(pileId, specimenId);
  };

  const handleRemoveSpecimenFromPile = async (pileId: string, specimenId: string) => {
    const pile = piles.find(p => p.id === pileId);
    const specimen = specimens.find(s => s.id === specimenId);
    if (!pile || !specimen || !pile.specimenIds.includes(specimenId)) return;

    const updatedPiles = piles.map(p => {
      if (p.id === pileId) {
        return {
          ...p,
          specimenIds: p.specimenIds.filter(id => id !== specimenId)
        };
      }
      return p;
    });

    setPiles(updatedPiles);
    pushHistory('REMOVE_FROM_PILE', `Removed ${specimen.scientificName} from ${pile.name}`, { pileId, specimenId });
    await DatabaseService.removeSpecimenFromPile(pileId, specimenId);
  };

  const handleTogglePile = async (pileId: string, specimenId: string) => {
    const pile = piles.find(p => p.id === pileId);
    if (!pile) return;

    const isInPile = pile.specimenIds.includes(specimenId);
    if (isInPile) {
      await handleRemoveSpecimenFromPile(pileId, specimenId);
    } else {
      await handleAddSpecimenToPile(pileId, specimenId);
    }
  };

  const handleAddAnnotation = async (specimenId: string, annotation: Annotation) => {
    setSpecimens(prev => prev.map(s => 
      s.id === specimenId 
        ? { ...s, annotations: [annotation, ...s.annotations] } 
        : s
    ));

    pushHistory('ADD_ANNOTATION', `Added annotation to specimen`, { specimenId, annotationId: annotation.id });

    try {
      await DatabaseService.addAnnotation(specimenId, annotation);
    } catch (error) {
      console.error("Failed to save annotation:", error);
    }
  };

  const handleDeleteSpecimen = async (id: string) => {
    const specimenToDelete = specimens.find(s => s.id === id);
    if (!specimenToDelete) return;
    if (!confirm("Are you sure you want to delete this specimen?")) return;
    
    setSpecimens(prev => prev.filter(s => s.id !== id));
    pushHistory('DELETE_SPECIMEN', `Deleted specimen: ${specimenToDelete.scientificName}`, { specimen: specimenToDelete });
    
    setView('gallery');

    try {
      await DatabaseService.deleteSpecimen(id);
    } catch (error) {
      console.error("Delete failed:", error);
      loadData();
    }
  };

  const openSpecimen = (id: string) => {
    setSelectedSpecimenId(id);
    setView('detail');
  };

  const toggleColumn = (colId: ColumnId) => {
    setVisibleColumns(prev =>
      prev.includes(colId)
        ? prev.filter(id => id !== colId)
        : [...prev, colId]
    );
  };

  const handleMapMarkerClick = (id: string) => {
    setSelectedSpecimenId(id);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ActionHistory 
        history={history} 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        onUndo={handleUndo} 
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('gallery'); setActivePileId(null); }}>
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
                placeholder="Search collection..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all relative"
              title="View History"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {history.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
              )}
            </button>
            <Button variant="primary" onClick={() => setView('add')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Specimen</span>
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
              <div className="flex flex-col md:flex-row gap-8 relative">
                {/* Collapsible Sidebar */}
                <div
                  className={`relative transition-all duration-300 ${
                    isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-full md:w-80'
                  }`}
                >
                  {!isSidebarCollapsed && (
                    <PileSidebar
                      piles={piles}
                      activePileId={activePileId}
                      onSelectPile={setActivePileId}
                      onCreatePile={handleCreatePile}
                      onDeletePile={handleDeletePile}
                      onDropSpecimen={handleAddSpecimenToPile}
                      onRemoveFromPile={handleRemoveSpecimenFromPile}
                    />
                  )}
                </div>

                <div className={`flex-1 min-0 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-0' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                      {/* Sidebar Toggle */}
                      <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                        title={isSidebarCollapsed ? "Show piles sidebar" : "Hide piles sidebar"}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>

                      <div>
                        <h2 className="text-3xl font-bold text-slate-900 serif">
                          {activePile ? activePile.name : 'Digital Collection'}
                        </h2>
                        <p className="text-slate-500 mt-1">
                          {activePile ? (activePile.description || 'Virtual collection of selected specimens') : 'Curated primary database'}
                          • Found {filteredSpecimens.length} items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {layout === 'table' && (
                        <div className="relative" ref={columnPickerRef}>
                          <button 
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            title="Configure Columns"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                          </button>

                          {showColumnPicker && (
                            <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Visible Columns</h4>
                              <div className="space-y-2">
                                {ALL_COLUMNS.map(col => (
                                  <label key={col.id} className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                      type="checkbox" 
                                      checked={visibleColumns.includes(col.id)} 
                                      onChange={() => toggleColumn(col.id)}
                                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                    />
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                                      {col.label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                          onClick={() => setLayout('grid')}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'grid' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                          Grid
                        </button>
                        <button
                          onClick={() => setLayout('table')}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Table
                        </button>
                        <button
                          onClick={() => setLayout('map')}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'map' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          Map
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredSpecimens.length > 0 ? (
                    layout === 'map' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Panel: Scrollable List */}
                        <div className="space-y-4 max-h-[800px] overflow-y-auto">
                          {filteredSpecimens.map(s => (
                            <SpecimenMapCard
                              key={s.id}
                              specimen={s}
                              isSelected={selectedSpecimenId === s.id}
                              onClick={() => handleMapMarkerClick(s.id)}
                            />
                          ))}
                        </div>

                        {/* Right Panel: Map */}
                        <div className="sticky top-4 h-[800px]">
                          <MapView
                            specimens={filteredSpecimens}
                            selectedSpecimenId={selectedSpecimenId}
                            onSelectSpecimen={handleMapMarkerClick}
                          />
                        </div>
                      </div>
                    ) : layout === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSpecimens.map(s => (
                          <SpecimenCard
                            key={s.id}
                            specimen={s}
                            onClick={openSpecimen}
                          />
                        ))}
                      </div>
                    ) : (
                      <SpecimenTable
                        specimens={filteredSpecimens}
                        onClick={openSpecimen}
                        visibleColumns={visibleColumns}
                      />
                    )
                  ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
                      <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600">
                        {activePileId ? 'Pile Empty' : 'Database Empty'}
                      </h3>
                      <p className="text-slate-400 mt-2">
                        {activePileId ? 'Add specimens to this virtual collection from the main gallery.' : 'Add your first specimen to start the digital herbarium.'}
                      </p>
                      {!activePileId && (
                        <Button variant="outline" className="mx-auto mt-6" onClick={() => setView('add')}>
                          Register New Specimen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(view === 'add' || view === 'edit') && (
              <SpecimenForm 
                initialData={view === 'edit' ? activeSpecimen : undefined}
                onSubmit={handleSaveSpecimen} 
                onCancel={() => view === 'edit' ? setView('detail') : setView('gallery')} 
              />
            )}

            {view === 'detail' && activeSpecimen && (
              <SpecimenDetail 
                specimen={activeSpecimen} 
                onBack={() => setView('gallery')}
                onEdit={() => setView('edit')}
                onAddAnnotation={handleAddAnnotation}
                onDelete={() => handleDeleteSpecimen(activeSpecimen.id)}
                piles={piles}
                onTogglePile={handleTogglePile}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs">
          <p>© 2024 Herbarium Pro • Relational Specimen Curation Engine</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-emerald-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Export DB</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">API v1.0</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
