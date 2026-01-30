import React, { useMemo, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Specimen, Pile, Annotation } from '../../types';
import SpecimenDetail from '../SpecimenDetail';
import Button from '../Button';
import { useSpecimenUrl } from '../../hooks/useSpecimenUrl';
import { apiClient } from '../../services/apiClient';

interface SpecimenDetailViewProps {
  specimens: Specimen[];
  piles: Pile[];
  isLoading: boolean;
  onAddAnnotation: (specimenId: number, annotation: Annotation) => void;
  onDeleteAnnotation: (specimenId: string, annotationId: number) => void;
  onDelete: (id: number) => void;
  onTogglePile: (pileId: number, specimenId: number) => void;
  onEdit: (id: number) => void;
}

const SpecimenDetailView: React.FC<SpecimenDetailViewProps> = ({
  specimens,
  piles,
  isLoading,
  onAddAnnotation,
  onDeleteAnnotation,
  onDelete,
  onTogglePile,
  onEdit,
}) => {
  const { id } = useParams<{ id: string }>();
  const { navigateToGallery, navigateToSpecimen } = useSpecimenUrl();
  const specimenId = id ? parseInt(id) : null;
  const [fetchedSpecimen, setFetchedSpecimen] = useState<Specimen | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Try to find specimen in the specimens array first
  const specimenFromList = useMemo(() => {
    return specimens.find(s => s.id === specimenId);
  }, [specimens, specimenId]);

  // Reset fetched specimen when ID changes
  useEffect(() => {
    setFetchedSpecimen(null);
    setFetchError(false);
  }, [specimenId]);

  // If not found in list, fetch it from API
  useEffect(() => {
    if (specimenId && !specimenFromList && !isLoading && !isFetching && !fetchedSpecimen && !fetchError) {
      setIsFetching(true);
      apiClient.getSpecimen(specimenId)
        .then(data => {
          setFetchedSpecimen(data);
          setFetchError(false);
        })
        .catch(error => {
          console.error('Failed to fetch specimen:', error);
          setFetchError(true);
        })
        .finally(() => {
          setIsFetching(false);
        });
    }
  }, [specimenId, specimenFromList, isLoading, isFetching, fetchedSpecimen, fetchError]);

  // Use specimen from list if available, otherwise use fetched specimen
  const specimen = specimenFromList || fetchedSpecimen;

  const currentSpecimenIndex = useMemo(() => {
    return specimens.findIndex(s => s.id === specimenId);
  }, [specimens, specimenId]);

  const hasPreviousSpecimen = currentSpecimenIndex > 0;
  const hasNextSpecimen = currentSpecimenIndex !== -1 && currentSpecimenIndex < specimens.length - 1;

  const handlePreviousSpecimen = () => {
    if (hasPreviousSpecimen) {
      const previousSpecimen = specimens[currentSpecimenIndex - 1];
      // Use replace to avoid cluttering browser history
      navigateToSpecimen(previousSpecimen.id, true);
    }
  };

  const handleNextSpecimen = () => {
    if (hasNextSpecimen) {
      const nextSpecimen = specimens[currentSpecimenIndex + 1];
      // Use replace to avoid cluttering browser history
      navigateToSpecimen(nextSpecimen.id, true);
    }
  };

  // Keyboard shortcuts for navigation (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && hasPreviousSpecimen) {
        e.preventDefault();
        handlePreviousSpecimen();
      } else if (e.key === 'ArrowRight' && hasNextSpecimen) {
        e.preventDefault();
        handleNextSpecimen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPreviousSpecimen, hasNextSpecimen, specimens]);

  // Loading state
  if (isLoading || isFetching || (!specimen && !fetchError)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Loading specimen...</p>
      </div>
    );
  }

  // Handle specimen not found or deleted
  if (fetchError || !specimen) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Specimen Not Found</h2>
        <p className="text-slate-500 mb-6">
          The specimen you're looking for doesn't exist or has been removed.
        </p>
        <Button variant="primary" onClick={navigateToGallery}>
          Return to Gallery
        </Button>
      </div>
    );
  }

  return (
    <SpecimenDetail
      specimen={specimen}
      onBack={navigateToGallery}
      onEdit={() => onEdit(specimen.id)}
      onAddAnnotation={onAddAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
      onDelete={() => onDelete(specimen.id)}
      piles={piles}
      onTogglePile={onTogglePile}
      onNext={handleNextSpecimen}
      onPrevious={handlePreviousSpecimen}
      hasNext={hasNextSpecimen}
      hasPrevious={hasPreviousSpecimen}
    />
  );
};

export default SpecimenDetailView;
