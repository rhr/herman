
import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Button from './Button';
import Autocomplete from './Autocomplete';
import { Specimen, SpecimenFormData } from '../types';
import { extractSpecimenData } from '../services/geminiService';
import { apiClient } from '../services/apiClient';

interface SpecimenFormProps {
  initialData?: Specimen;
  onSubmit: (data: any, id?: string) => void;
  onCancel: () => void;
}

const SpecimenForm: React.FC<SpecimenFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<SpecimenFormData>>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        code: initialData.code || '',
        scientificName: initialData.scientificName,
        family: initialData.family,
        genus: initialData.genus,
        wcvpId: initialData.wcvpId,
        collector: initialData.collector,
        collectorNumber: initialData.collectorNumber || '',
        collectionDate: initialData.collectionDate,
        country: initialData.country || '',
        stateProvince: initialData.stateProvince || '',
        countyCity: initialData.countyCity || '',
        localityDescription: initialData.localityDescription || '',
        latitude: initialData.latitude || '',
        longitude: initialData.longitude || '',
        latdd: initialData.latdd !== undefined && initialData.latdd !== null ? initialData.latdd.toString() : '',
        londd: initialData.londd !== undefined && initialData.londd !== null ? initialData.londd.toString() : '',
        elevation: initialData.elevation || '',
        habitat: initialData.habitat || '',
        microhabitat: initialData.microhabitat || '',
        description: initialData.description,
      });
      setImagePreviews(initialData.imageUrls);
    }
  }, [initialData]);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), ...files]
      }));
    }
  };

  const removeImage = async (index: number) => {
    // Check if this is an existing image (has an ID in initialData)
    const isExistingImage = initialData?.images && index < initialData.images.length;

    if (isExistingImage && initialData?.images) {
      // This is an existing image in the database - delete it via API
      const image = initialData.images[index];
      if (!image) return;

      if (!confirm('Are you sure you want to delete this image? This cannot be undone.')) {
        return;
      }

      setIsDeletingImage(true);
      try {
        await apiClient.deleteImage(image.id);

        // Remove from local state
        setImagePreviews(prev => prev.filter((_, i) => i !== index));

        // Update initialData.images to reflect deletion
        if (initialData && initialData.images) {
          const newImages = initialData.images.filter((_, i) => i !== index);
          initialData.images = newImages;
        }
      } catch (error) {
        console.error('Failed to delete image:', error);
        alert('Failed to delete image. Please try again.');
      } finally {
        setIsDeletingImage(false);
      }
    } else {
      // This is a newly added image (not yet saved) - just remove from preview
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
      setFormData(prev => ({
        ...prev,
        images: prev.images?.filter((_, i) => i !== index - (initialData?.images?.length || 0))
      }));
    }
  };

  const handleSetPrimaryImage = async (imageIndex: number) => {
    if (!initialData?.images || imageIndex === 0 || isSettingPrimary) return;

    const image = initialData.images[imageIndex];
    if (!image) return;

    setIsSettingPrimary(true);
    try {
      await apiClient.setPrimaryImage(image.id);

      // Optimistically update the local state to reorder images
      // Move the selected image to the front
      const newPreviews = [...imagePreviews];
      const [selectedPreview] = newPreviews.splice(imageIndex, 1);
      newPreviews.unshift(selectedPreview);
      setImagePreviews(newPreviews);

      // Update initialData.images if it exists (for proper tracking)
      if (initialData && initialData.images) {
        const newImages = [...initialData.images];
        const [selectedImage] = newImages.splice(imageIndex, 1);
        newImages.unshift(selectedImage);
        initialData.images = newImages;
      }
    } catch (error) {
      console.error('Failed to set primary image:', error);
      alert('Failed to set primary image. Please try again.');
    } finally {
      setIsSettingPrimary(false);
    }
  };

  const handleScanLabel = async () => {
    if (imagePreviews.length === 0) return;
    setIsScanning(true);
    try {
      // Use the first image for label extraction
      const base64 = imagePreviews[0].split(',')[1];
      const extracted = await extractSpecimenData(base64);
      setFormData(prev => ({
        ...prev,
        code: extracted.code || prev.code,
        scientificName: extracted.scientificName || prev.scientificName,
        family: extracted.family || prev.family,
        genus: extracted.genus || prev.genus,
        collector: extracted.collector || prev.collector,
        collectionDate: extracted.collectionDate || prev.collectionDate,
        country: extracted.country || prev.country,
        stateProvince: extracted.stateProvince || prev.stateProvince,
        countyCity: extracted.countyCity || prev.countyCity,
        localityDescription: extracted.localityDescription || prev.localityDescription,
        habitat: extracted.habitat || prev.habitat,
        description: extracted.description || prev.description,
      }));
    } catch (error) {
      console.error("AI Extraction failed:", error);
      alert("Failed to extract data from image. Please enter manually.");
    } finally {
      setIsScanning(false);
    }
  };

  const getLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setFormData(prev => ({
        ...prev,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString(),
        latdd: pos.coords.latitude.toString(),
        londd: pos.coords.longitude.toString(),
      }));
    }, (err) => {
      alert("Could not retrieve location. Please check browser permissions.");
    });
  };

  // Validate coordinate values
  const validateLatitude = (value: string): boolean => {
    if (value === '') return true; // Empty is valid
    const num = parseFloat(value);
    return !isNaN(num) && num >= -90 && num <= 90;
  };

  const validateLongitude = (value: string): boolean => {
    if (value === '') return true; // Empty is valid
    const num = parseFloat(value);
    return !isNaN(num) && num >= -180 && num <= 180;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Images are optional - allow saving specimens without images
    onSubmit({ ...formData, imageUrls: imagePreviews }, initialData?.id);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !selectionStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionEnd({ x, y });
  };

  const handleMouseUp = (
    setTransform: (x: number, y: number, scale: number, animationTime?: number) => void,
    state: { positionX: number; positionY: number; scale: number }
  ) => {
    if (!isSelectingArea || !selectionStart || !selectionEnd || !imageContainerRef.current) {
      return;
    }

    // Calculate selection rectangle
    const x1 = Math.min(selectionStart.x, selectionEnd.x);
    const y1 = Math.min(selectionStart.y, selectionEnd.y);
    const x2 = Math.max(selectionStart.x, selectionEnd.x);
    const y2 = Math.max(selectionStart.y, selectionEnd.y);
    const width = x2 - x1;
    const height = y2 - y1;

    // Ignore very small selections (likely accidental clicks)
    if (width < 20 || height < 20) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    // Get container dimensions
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Convert selection coordinates from screen space to content space
    // Account for current transform
    const contentX1 = (x1 - state.positionX) / state.scale;
    const contentY1 = (y1 - state.positionY) / state.scale;
    const contentWidth = width / state.scale;
    const contentHeight = height / state.scale;

    // Calculate new scale to fit selection to container
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newScale = Math.min(scaleX, scaleY, 4); // Cap at maxScale of 4

    // Calculate center of selection in content space
    const contentCenterX = contentX1 + contentWidth / 2;
    const contentCenterY = contentY1 + contentHeight / 2;

    // Calculate new pan position to center the selection
    const newPanX = containerWidth / 2 - contentCenterX * newScale;
    const newPanY = containerHeight / 2 - contentCenterY * newScale;

    // Apply transformation with animation
    setTransform(newPanX, newPanY, newScale, 300);

    // Reset selection after a small delay to avoid interfering with animation
    setTimeout(() => {
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsSelectingArea(false);
    }, 50);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 serif">
        {initialData ? 'Edit Specimen' : 'Register New Specimen'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image Upload & Preview */}
        <div className="space-y-4">
          <div className="aspect-[3/4] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative">
            {imagePreviews.length > 0 ? (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit={true}
                panning={{ disabled: isSelectingArea }}
              >
                {(props) => {
                  const { zoomIn, zoomOut, resetTransform, setTransform } = props;
                  // Try to access state from props - it might be under a different name
                  const state = (props as any).state || (props as any).transformState || { scale: 1, positionX: 0, positionY: 0 };

                  return (
                  <>
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSelectingArea(!isSelectingArea);
                          setSelectionStart(null);
                          setSelectionEnd(null);
                        }}
                        className={`${
                          isSelectingArea
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/90 hover:bg-white text-slate-700'
                        } p-2 rounded-lg shadow-md transition-all`}
                        title="Select area to zoom"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9V5a2 2 0 012-2h4m6 0h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4m-6 0H5a2 2 0 01-2-2v-4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                        className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                        title="Zoom in"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                        className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                        title="Zoom out"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resetTransform(); }}
                        className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                        title="Reset zoom"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="bg-emerald-500/90 hover:bg-emerald-500 text-white p-2 rounded-lg shadow-md transition-all"
                        title="Change image"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                    </div>
                    <div
                      ref={imageContainerRef}
                      className="relative"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                        <img src={imagePreviews[0]} className="w-full h-full object-contain" alt="Preview" />
                      </TransformComponent>
                      {/* Interactive overlay for selection mode */}
                      {isSelectingArea && (
                        <div
                          className="absolute inset-0 cursor-crosshair"
                          style={{ zIndex: 20 }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={() => handleMouseUp(setTransform, state)}
                        >
                          {/* Selection Rectangle Visual */}
                          {selectionStart && selectionEnd && (
                            <div
                              className="absolute border-2 border-emerald-500 bg-emerald-500/20"
                              style={{
                                left: Math.min(selectionStart.x, selectionEnd.x),
                                top: Math.min(selectionStart.y, selectionEnd.y),
                                width: Math.abs(selectionEnd.x - selectionStart.x),
                                height: Math.abs(selectionEnd.y - selectionStart.y),
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </>
                  );
                }}
              </TransformWrapper>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all"
              >
                <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-500 font-medium text-center px-4">Click to upload specimen images</p>
                <p className="text-xs text-slate-400 mt-1">Multiple files supported</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImagesChange}
              className="hidden"
              accept="image/*"
              multiple
            />
          </div>

          {imagePreviews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {imagePreviews.map((src, i) => {
                // Check if this is an existing image (has image object in initialData)
                const isExistingImage = initialData?.images && i < initialData.images.length;

                return (
                  <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={src} className="w-full h-full object-cover" alt={`Thumb ${i}`} />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      disabled={isDeletingImage}
                      className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 disabled:opacity-50"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {i === 0 ? (
                      <div className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-[8px] text-white text-center py-0.5 uppercase font-bold pointer-events-none">
                        Primary
                      </div>
                    ) : isExistingImage ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(i)}
                        disabled={isSettingPrimary}
                        className="absolute inset-0 bg-black/60 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-50"
                      >
                        Set as Primary
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleScanLabel}
            isLoading={isScanning}
            disabled={imagePreviews.length === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Auto-Extract Label from Primary Image (AI)
          </Button>
        </div>

        {/* Right: Data Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
              <input
                type="text"
                placeholder="Legacy specimen code"
                value={formData.code || ''}
                onChange={e => setFormData({...formData, code: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scientific Name</label>
              <Autocomplete
                value={formData.scientificName || ''}
                onChange={(value) => setFormData({...formData, scientificName: value})}
                onSelect={(suggestion) => {
                  // Auto-fill family, genus, and WCVP ID from selected scientific name
                  setFormData({
                    ...formData,
                    scientificName: suggestion.value,
                    family: suggestion.family || formData.family,
                    genus: suggestion.genus || formData.genus,
                    wcvpId: suggestion.taxon_id || formData.wcvpId,
                  });
                }}
                fetchSuggestions={(q) => apiClient.autocompleteScientificName(q)}
                placeholder="Genus species"
                className="italic"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Family</label>
              <Autocomplete
                value={formData.family || ''}
                onChange={(value) => setFormData({...formData, family: value})}
                fetchSuggestions={(q) => apiClient.autocompleteFamily(q)}
                placeholder="Family"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Genus</label>
              <Autocomplete
                value={formData.genus || ''}
                onChange={(value) => setFormData({...formData, genus: value})}
                fetchSuggestions={(q) => apiClient.autocompleteGenus(q, 10, formData.family)}
                placeholder="Genus"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Collector</label>
              <input
                type="text"
                placeholder="Collector name"
                value={formData.collector || ''}
                onChange={e => setFormData({...formData, collector: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Collector Number</label>
              <input
                type="text"
                placeholder="Collection number"
                value={formData.collectorNumber || ''}
                onChange={e => setFormData({...formData, collectorNumber: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div className="col-span-2 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold text-emerald-600 uppercase mb-3 tracking-widest">Locality Hierarchy</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Country</label>
                  <input 
                    type="text" 
                    placeholder="e.g. USA"
                    value={formData.country || ''} 
                    onChange={e => setFormData({...formData, country: e.target.value})}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Province/State</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CA"
                    value={formData.stateProvince || ''} 
                    onChange={e => setFormData({...formData, stateProvince: e.target.value})}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">County/City</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SF"
                    value={formData.countyCity || ''} 
                    onChange={e => setFormData({...formData, countyCity: e.target.value})}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Habitat</label>
              <input
                type="text"
                placeholder="e.g. Wet coastal forest, sandy soil"
                value={formData.habitat || ''}
                onChange={e => setFormData({...formData, habitat: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Microhabitat</label>
              <input
                type="text"
                placeholder="e.g. Under rock overhang, on north-facing slope"
                value={formData.microhabitat || ''}
                onChange={e => setFormData({...formData, microhabitat: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specific Locality Details</label>
              <textarea 
                placeholder="Near the junction of Hwy 1 and Main St..."
                value={formData.localityDescription || ''} 
                onChange={e => setFormData({...formData, localityDescription: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg h-16 text-sm" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Verbatim Coordinates
                <span className="block text-[10px] font-normal text-slate-400 normal-case mt-0.5">As written on specimen label</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 37°46'N or 37.7749"
                  value={formData.latitude || ''}
                  onChange={e => setFormData({...formData, latitude: e.target.value})}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  title="Verbatim latitude exactly as written on label"
                />
                <input
                  type="text"
                  placeholder="e.g. 122°25'W or -122.4194"
                  value={formData.longitude || ''}
                  onChange={e => setFormData({...formData, longitude: e.target.value})}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  title="Verbatim longitude exactly as written on label"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Decimal Degrees
                <span className="block text-[10px] font-normal text-slate-400 normal-case mt-0.5">For mapping (Lat: -90 to 90, Lon: -180 to 180)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 37.7749)"
                  value={formData.latdd || ''}
                  onChange={e => {
                    const value = e.target.value;
                    if (validateLatitude(value)) {
                      setFormData({...formData, latdd: value});
                    }
                  }}
                  className={`w-full p-2 border rounded-lg text-sm ${
                    formData.latdd && !validateLatitude(formData.latdd)
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-slate-200'
                  }`}
                  title="Latitude in decimal degrees (-90 to 90)"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. -122.4194)"
                  value={formData.londd || ''}
                  onChange={e => {
                    const value = e.target.value;
                    if (validateLongitude(value)) {
                      setFormData({...formData, londd: value});
                    }
                  }}
                  className={`w-full p-2 border rounded-lg text-sm ${
                    formData.londd && !validateLongitude(formData.londd)
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-slate-200'
                  }`}
                  title="Longitude in decimal degrees (-180 to 180)"
                />
              </div>
            </div>

            <div className="flex items-end col-span-2">
              <Button type="button" variant="outline" className="w-full text-xs" onClick={getLocation}>
                Get Current Location
              </Button>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Collection Date</label>
              <input 
                type="text" 
                placeholder="YYYY-MM-DD, YYYY-MM, or YYYY"
                value={formData.collectionDate || ''} 
                onChange={e => setFormData({...formData, collectionDate: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1">
              {initialData ? 'Update Specimen' : 'Save Specimen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpecimenForm;
