
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Specimen, Annotation, Pile, HistoryEntry, ActionType } from './types';
import SpecimenForm from './components/SpecimenForm';
import SpecimenDetail from './components/SpecimenDetail';
import { ColumnId, SortableColumnId, SortDirection } from './components/SpecimenTable';
import ActionHistory from './components/ActionHistory';
import AuthModal from './components/AuthModal';
import Button from './components/Button';
import GalleryView from './components/views/GalleryView';
import SpecimenDetailView from './components/views/SpecimenDetailView';
import AddSpecimenView from './components/views/AddSpecimenView';
import EditSpecimenView from './components/views/EditSpecimenView';
import AuditLogsView from './components/views/AuditLogsView';
import RegisterView from './components/views/RegisterView';
import { DatabaseService } from './services/databaseService';
import { apiClient } from './services/apiClient';
import { useSpecimenUrl } from './hooks/useSpecimenUrl';

const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'specimen', label: 'Specimen Info' },
  { id: 'code', label: 'Code' },
  { id: 'family', label: 'Family' },
  { id: 'genus', label: 'Genus' },
  { id: 'locality', label: 'Locality' },
  { id: 'habitat', label: 'Habitat' },
  { id: 'collector', label: 'Collector' },
  { id: 'collectorNumber', label: 'Collector Number' },
  { id: 'date', label: 'Date' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Modified' },
  { id: 'id', label: 'Database ID' },
];

const App: React.FC = () => {
  // URL-driven state
  const { urlState, updateUrlState, navigateToSpecimen, navigateToGallery, navigateToAdd, navigateToEdit } = useSpecimenUrl();
  const { searchQuery, sortColumn, sortDirection, currentPage, activePileId, layout } = urlState;

  // Local state
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [piles, setPiles] = useState<Pile[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(() => {
    const saved = localStorage.getItem('visibleColumns');
    return saved ? JSON.parse(saved) : ['specimen', 'family', 'locality', 'collector', 'date'];
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('isSidebarCollapsed');
    return saved === 'true';
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const prevSearchRef = useRef<string>(searchQuery);

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

  // Persist visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Persist layout preference to localStorage
  useEffect(() => {
    localStorage.setItem('layout', layout);
  }, [layout]);

  // Persist sidebar visibility to localStorage
  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        setShowAuthModal(true);
        setIsLoading(false);
      } else {
        try {
          const user = await apiClient.getCurrentUser();
          setCurrentUser(user);
          // loadData will be triggered by URL state effect
        } catch (error) {
          console.error('Authentication check failed:', error);
          setShowAuthModal(true);
          setIsLoading(false);
        }
      }
    };
    checkAuth();
  }, []);

  // Consolidated data loading effect driven by URL state
  useEffect(() => {
    if (!apiClient.isAuthenticated()) return;

    // Debounce search updates
    const timeoutId = setTimeout(() => {
      loadData(currentPage, searchQuery, sortColumn || undefined, sortDirection, activePileId);
    }, searchQuery !== prevSearchRef.current ? 300 : 0);

    prevSearchRef.current = searchQuery;

    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortColumn, sortDirection, currentPage, activePileId, currentUser]);

  const loadData = async (
    page: number = currentPage,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
    pileId?: number | null
  ) => {
    if (!apiClient.isAuthenticated()) {
      setShowAuthModal(true);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Loading data...');
      const currentSearch = search !== undefined ? search : searchQuery;
      const currentSortBy = sortBy !== undefined ? sortBy : (sortColumn || undefined);
      const currentSortDir = sortDir !== undefined ? sortDir : sortDirection;
      const currentPileId = pileId !== undefined ? pileId : activePileId;

      const [specimenResponse, pileData] = await Promise.all([
        DatabaseService.getAllSpecimens(page, pageSize, currentSearch || undefined, currentSortBy, currentSortDir, currentPileId),
        DatabaseService.getAllPiles()
      ]);
      console.log('Data loaded successfully:', {
        specimens: specimenResponse.specimens.length,
        total: specimenResponse.pagination.total,
        page: specimenResponse.pagination.page,
        search: currentSearch,
        sortBy: currentSortBy,
        sortDir: currentSortDir,
        piles: pileData.length
      });
      setSpecimens(specimenResponse.specimens);
      setTotalPages(specimenResponse.pagination.totalPages);
      setTotalItems(specimenResponse.pagination.total);
      setPiles(pileData);

      // Update URL if page is out of range
      if (specimenResponse.pagination.page !== currentPage) {
        updateUrlState({ currentPage: specimenResponse.pagination.page }, true);
      }
    } catch (error: any) {
      console.error("Failed to load data:", error);
      console.error("Error details:", { message: error.message, stack: error.stack });
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        // Token expired or invalid
        console.log('Auth error detected, logging out');
        apiClient.logout();
        setShowAuthModal(true);
      } else {
        // Show error to user for other errors
        alert(`Failed to load data: ${error.message || 'Unknown error'}. Check console for details.`);
      }
    } finally {
      console.log('Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const pushHistory = (type: ActionType, description: string, data: any) => {
    const entry: HistoryEntry = {
      id: Date.now(), // Use timestamp as integer ID for history entries
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


  /**
   * Parse coordinate string to decimal degrees
   * Supports formats:
   * - Decimal degrees: "37.7749", "-122.4194"
   * - DMS: "37°46'23.5"N", "122°25'9.6"W"
   * - DMS with spaces: "37° 46' 23.5" N"
   * - DMS with d/m/s: "37d46m23.5sN"
   * - Direction indicators: N/S for latitude, E/W for longitude
   */
  const parseCoordinate = (coordStr: string): number | undefined => {
    if (!coordStr || coordStr.trim() === '') {
      return undefined;
    }

    try {
      const str = coordStr.trim().toUpperCase();

      // Check for direction at the end (N/S/E/W as direction indicators, not part of DMS notation)
      // Look for direction letters that are NOT preceded by a digit (to avoid catching 's' in '23.5s')
      const directionMatch = str.match(/[NSEW]$/);
      const isNegative = directionMatch ? (directionMatch[0] === 'S' || directionMatch[0] === 'W') : false;

      // Remove direction indicators at the end only
      let cleanStr = str.replace(/[NSEW]$/, '').trim();

      // Try simple decimal format first
      const simpleDecimal = parseFloat(cleanStr);
      if (!isNaN(simpleDecimal) && !cleanStr.includes('°') && !cleanStr.includes('D') && !cleanStr.includes('\'') && !cleanStr.includes('"')) {
        return isNegative ? -Math.abs(simpleDecimal) : simpleDecimal;
      }

      // Parse DMS format
      // Replace common separators with spaces for consistent parsing
      cleanStr = cleanStr
        .replace(/°/g, ' ')      // degrees symbol
        .replace(/D/gi, ' ')     // degrees letter (case insensitive)
        .replace(/['′]/g, ' ')   // minutes
        .replace(/M/gi, ' ')     // minutes letter
        .replace(/["″]/g, ' ')   // seconds
        .replace(/S/gi, ' ')     // seconds letter (now safe since we removed direction)
        .replace(/\s+/g, ' ')    // normalize multiple spaces
        .trim();

      // Extract numbers
      const parts = cleanStr.split(' ').filter(p => p.length > 0).map(p => parseFloat(p)).filter(n => !isNaN(n));

      if (parts.length === 0) {
        return undefined;
      }

      // Calculate decimal degrees
      let decimal = parts[0]; // degrees

      if (parts.length > 1) {
        decimal += parts[1] / 60; // minutes
      }

      if (parts.length > 2) {
        decimal += parts[2] / 3600; // seconds
      }

      // Apply negative for S/W
      if (isNegative) {
        decimal = -Math.abs(decimal);
      }

      return decimal;
    } catch (error) {
      console.warn('Failed to parse coordinate:', coordStr, error);
      return undefined;
    }
  };

  const handleSaveSpecimen = async (data: any, id?: number) => {
    const isEditing = !!id;
    const existingSpecimen = isEditing ? specimens.find(s => s.id === id) : null;

    // Use latdd/londd if provided, otherwise try to parse from verbatim coordinates
    let latdd: number | undefined = undefined;
    let londd: number | undefined = undefined;

    if (data.latdd !== undefined && data.latdd !== null && data.latdd !== '') {
      latdd = parseFloat(data.latdd);
    } else if (data.latitude) {
      latdd = parseCoordinate(data.latitude);
    }

    if (data.londd !== undefined && data.londd !== null && data.londd !== '') {
      londd = parseFloat(data.londd);
    } else if (data.longitude) {
      londd = parseCoordinate(data.longitude);
    }

    const specimenData: Specimen & { images?: File[] } = {
      id: id || 0, // Temporary ID, will be replaced by API response
      code: data.code || '',
      scientificName: data.scientificName || 'Unknown',
      family: data.family || 'Unknown',
      genus: data.genus || '',
      collector: data.collector || 'Anonymous',
      collectorNumber: data.collectorNumber || '',
      collectionDate: data.collectionDate || '',
      // Flattened locality fields
      country: data.country || '',
      stateProvince: data.stateProvince || '',
      countyCity: data.countyCity || '',
      localityDescription: data.localityDescription || '',
      latitude: data.latitude || '',
      longitude: data.longitude || '',
      latdd: latdd,
      londd: londd,
      elevation: data.elevation || '',
      habitat: data.habitat || '',
      imageUrls: data.imageUrls || [],
      description: data.description || '',
      microhabitat: data.microhabitat || '',
      annotations: existingSpecimen?.annotations || [],
      tags: existingSpecimen?.tags || [],
      images: data.images || [] // Include File objects from form
    };

    if (isEditing) {
      setSpecimens(prev => prev.map(s => s.id === id ? specimenData : s));
      pushHistory('UPDATE_SPECIMEN', `Updated specimen: ${specimenData.scientificName}`, {
        previousState: existingSpecimen,
        newState: specimenData
      });
      navigateToSpecimen(specimenData.id);
    } else {
      setSpecimens(prev => [specimenData, ...prev]);
      pushHistory('ADD_SPECIMEN', `Registered specimen: ${specimenData.scientificName}`, { id: specimenData.id });
      navigateToGallery();
    }

    try {
      if (isEditing) {
        await DatabaseService.updateSpecimen(specimenData);
        // Reload data after update to get actual image URLs from server
        await loadData();
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
      id: 0, // Temporary ID, will be replaced by API response
      name,
      description,
      specimenIds: [],
      createdAt: Date.now()
    };
    setPiles(prev => [newPile, ...prev]);
    pushHistory('ADD_PILE', `Created pile: ${name}`, { id: newPile.id });
    await DatabaseService.savePile(newPile);
  };

  const handleDeletePile = async (id: number) => {
    const pileToDelete = piles.find(p => p.id === id);
    if (!pileToDelete) return;
    if (!confirm("Delete this pile? Specimens will not be deleted.")) return;

    setPiles(prev => prev.filter(p => p.id !== id));
    pushHistory('DELETE_PILE', `Deleted pile: ${pileToDelete.name}`, { pile: pileToDelete });

    if (activePileId === id) setActivePileId(null);
    await DatabaseService.deletePile(id);
  };

  const handleReorderPiles = async (reorderedPiles: Pile[]) => {
    setPiles(reorderedPiles);
    try {
      await DatabaseService.savePiles(reorderedPiles);
    } catch (error) {
      console.error("Failed to save pile order:", error);
      loadData();
    }
  };

  const handleAddSpecimenToPile = async (pileId: number, specimenId: number) => {
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

  const handleRemoveSpecimenFromPile = async (pileId: number, specimenId: number) => {
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

  const handleTogglePile = async (pileId: number, specimenId: number) => {
    const pile = piles.find(p => p.id === pileId);
    if (!pile) return;

    const isInPile = pile.specimenIds.includes(specimenId);
    if (isInPile) {
      await handleRemoveSpecimenFromPile(pileId, specimenId);
    } else {
      await handleAddSpecimenToPile(pileId, specimenId);
    }
  };

  const handleAddAnnotation = async (specimenId: number, annotation: Annotation) => {
    const tempId = annotation.id; // Store temporary ID

    // Optimistically add annotation with temporary ID
    setSpecimens(prev => prev.map(s =>
      s.id === specimenId
        ? { ...s, annotations: [annotation, ...s.annotations] }
        : s
    ));

    try {
      // Save to database and get the real annotation with DB ID
      const savedAnnotation = await DatabaseService.addAnnotation(specimenId, annotation);

      // Replace the temporary annotation with the real one from the database
      setSpecimens(prev => prev.map(s =>
        s.id === specimenId
          ? {
              ...s,
              annotations: s.annotations.map(a =>
                a.id === tempId ? savedAnnotation : a
              )
            }
          : s
      ));

      pushHistory('ADD_ANNOTATION', `Added annotation to specimen`, { specimenId, annotationId: savedAnnotation.id });
    } catch (error) {
      console.error("Failed to save annotation:", error);
      // Remove the optimistically added annotation on error
      setSpecimens(prev => prev.map(s =>
        s.id === specimenId
          ? { ...s, annotations: s.annotations.filter(a => a.id !== tempId) }
          : s
      ));
      alert('Failed to save annotation. Please try again.');
    }
  };

  const handleDeleteAnnotation = (specimenId: string, annotationId: number) => {
    const numericId = typeof specimenId === 'string' ? parseInt(specimenId) : specimenId;

    // Update specimens array - activeSpecimen will automatically update via useMemo
    setSpecimens(prev => prev.map(s =>
      s.id === numericId
        ? { ...s, annotations: s.annotations.filter(a => a.id !== annotationId) }
        : s
    ));
  };

  const handleDeleteSpecimen = async (id: number) => {
    const specimenToDelete = specimens.find(s => s.id === id);
    if (!specimenToDelete) return;
    if (!confirm("Are you sure you want to delete this specimen?")) return;

    setSpecimens(prev => prev.filter(s => s.id !== id));
    pushHistory('DELETE_SPECIMEN', `Deleted specimen: ${specimenToDelete.scientificName}`, { specimen: specimenToDelete });

    navigateToGallery();

    try {
      await DatabaseService.deleteSpecimen(id);
    } catch (error) {
      console.error("Delete failed:", error);
      loadData();
    }
  };

  const handleSort = (column: SortableColumnId) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      updateUrlState({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' }, true);
    } else {
      // Set new column and default to ascending
      updateUrlState({ sortColumn: column, sortDirection: 'asc' }, true);
    }
  };

  const handleAuthSuccess = (user: any) => {
    console.log('Authentication successful:', user);
    setCurrentUser(user);
    setShowAuthModal(false);
    // loadData will be triggered by URL state effect when currentUser changes
  };

  const handleLogout = () => {
    apiClient.logout();
    setCurrentUser(null);
    setSpecimens([]);
    setPiles([]);
    setShowAuthModal(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateUrlState({ currentPage: newPage }, true);
    }
  };

  const location = useLocation();
  const isRegisterPage = location.pathname === '/register';

  // Render register page without header/footer
  if (isRegisterPage) {
    return <RegisterView />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ActionHistory
        history={history}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onUndo={handleUndo}
      />

      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { updateUrlState({ activePileId: null }, true); navigateToGallery(); }}>
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
                onChange={e => updateUrlState({ searchQuery: e.target.value, currentPage: 1 }, true)}
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
            <button
              onClick={() => window.location.href = '/audit-logs'}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
              title="Audit Logs"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {currentUser && (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">
                    {currentUser.name || currentUser.email}
                  </span>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
            <Button variant="primary" onClick={navigateToAdd}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Specimen</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Connecting to specimen database...</p>
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <GalleryView
                  specimens={specimens}
                  piles={piles}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  showColumnPicker={showColumnPicker}
                  setShowColumnPicker={setShowColumnPicker}
                  isSidebarCollapsed={isSidebarCollapsed}
                  setIsSidebarCollapsed={setIsSidebarCollapsed}
                  columnPickerRef={columnPickerRef}
                  onOpenSpecimen={navigateToSpecimen}
                  onCreatePile={handleCreatePile}
                  onDeletePile={handleDeletePile}
                  onDropSpecimen={handleAddSpecimenToPile}
                  onRemoveFromPile={handleRemoveSpecimenFromPile}
                  onReorderPiles={handleReorderPiles}
                  onSort={handleSort}
                  onPageChange={handlePageChange}
                  allColumns={ALL_COLUMNS}
                />
              }
            />
            <Route
              path="/add"
              element={
                <AddSpecimenView onSubmit={handleSaveSpecimen} />
              }
            />
            <Route
              path="/specimen/:id"
              element={
                <SpecimenDetailView
                  specimens={specimens}
                  piles={piles}
                  isLoading={isLoading}
                  onAddAnnotation={handleAddAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onDelete={handleDeleteSpecimen}
                  onTogglePile={handleTogglePile}
                  onEdit={navigateToEdit}
                />
              }
            />
            <Route
              path="/specimen/:id/edit"
              element={
                <EditSpecimenView
                  specimens={specimens}
                  isLoading={isLoading}
                  onSubmit={handleSaveSpecimen}
                />
              }
            />
            <Route
              path="/audit-logs"
              element={<AuditLogsView />}
            />
          </Routes>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-slate-400 text-xs">
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
