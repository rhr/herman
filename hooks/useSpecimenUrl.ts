import { useSearchParams, useNavigate } from 'react-router-dom';
import { SortableColumnId } from '../components/SpecimenTable';

export interface UrlState {
  searchQuery: string;
  sortColumn: SortableColumnId | null;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  activePileId: number | null;
  layout: 'grid' | 'table' | 'map';
}

export function useSpecimenUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse current URL state with validation
  const urlState: UrlState = {
    searchQuery: searchParams.get('search') || '',
    sortColumn: searchParams.get('sort') as SortableColumnId | null,
    sortDirection: (searchParams.get('sortDir') as 'asc' | 'desc') || 'asc',
    currentPage: Math.max(1, parseInt(searchParams.get('page') || '1') || 1),
    activePileId: searchParams.get('pile')
      ? (parseInt(searchParams.get('pile')!) || null)
      : null,
    layout: (searchParams.get('layout') as 'grid' | 'table' | 'map') ||
      (localStorage.getItem('layout') as 'grid' | 'table' | 'map') || 'grid',
  };

  // Update URL with new state (default to replace mode for filters)
  const updateUrlState = (updates: Partial<UrlState>, replace = true) => {
    const newParams = new URLSearchParams(searchParams);

    // Map UrlState keys to URL param keys
    const keyMap: Record<string, string> = {
      searchQuery: 'search',
      sortColumn: 'sort',
      sortDirection: 'sortDir',
      currentPage: 'page',
      activePileId: 'pile',
      layout: 'layout',
    };

    Object.entries(updates).forEach(([key, value]) => {
      const paramKey = keyMap[key] || key;

      if (value === null || value === undefined || value === '') {
        newParams.delete(paramKey);
      } else {
        newParams.set(paramKey, String(value));
      }
    });

    setSearchParams(newParams, { replace });
  };

  // Navigation helpers
  const navigateToSpecimen = (id: number, replace = false) => {
    // Preserve current query params when navigating to specimen
    const queryString = searchParams.toString();
    const url = `/specimen/${id}${queryString ? `?${queryString}` : ''}`;
    navigate(url, { replace });
  };

  const navigateToGallery = () => {
    const queryString = searchParams.toString();
    navigate(`/${queryString ? `?${queryString}` : ''}`);
  };

  const navigateToAdd = () => {
    navigate('/add');
  };

  const navigateToEdit = (id: number) => {
    navigate(`/specimen/${id}/edit`);
  };

  return {
    urlState,
    updateUrlState,
    navigateToSpecimen,
    navigateToGallery,
    navigateToAdd,
    navigateToEdit,
  };
}
