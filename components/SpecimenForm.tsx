
import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';
import { Specimen, SpecimenFormData } from '../types';
import { extractSpecimenData } from '../services/geminiService';

interface SpecimenFormProps {
  initialData?: Specimen;
  onSubmit: (data: any, id?: string) => void;
  onCancel: () => void;
}

const SpecimenForm: React.FC<SpecimenFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<SpecimenFormData>>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        scientificName: initialData.scientificName,
        family: initialData.family,
        genus: initialData.genus,
        collector: initialData.collector,
        collectionDate: initialData.collectionDate,
        country: initialData.locality.country,
        stateProvince: initialData.locality.stateProvince,
        countyCity: initialData.locality.countyCity,
        localityDescription: initialData.locality.description,
        latitude: initialData.locality.latitude?.toString() || '',
        longitude: initialData.locality.longitude?.toString() || '',
        habitat: initialData.locality.habitat || '',
        description: initialData.description,
      });
      setImagePreviews(initialData.imageUrls);
    }
  }, [initialData]);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      files.forEach(file => {
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

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index)
    }));
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
      }));
    }, (err) => {
      alert("Could not retrieve location. Please check browser permissions.");
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imagePreviews.length === 0) {
      alert("Please upload at least one image of the specimen.");
      return;
    }
    onSubmit({ ...formData, imageUrls: imagePreviews }, initialData?.id);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-5xl mx-auto border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 serif">
        {initialData ? 'Edit Specimen' : 'Register New Specimen'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image Upload & Preview */}
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[3/4] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all bg-slate-50 overflow-hidden relative"
          >
            {imagePreviews.length > 0 ? (
              <img src={imagePreviews[0]} className="w-full h-full object-contain" alt="Preview" />
            ) : (
              <>
                <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-500 font-medium text-center px-4">Click to upload specimen images</p>
                <p className="text-xs text-slate-400 mt-1">Multiple files supported</p>
              </>
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
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                  <img src={src} className="w-full h-full object-cover" alt={`Thumb ${i}`} />
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-[8px] text-white text-center py-0.5 uppercase font-bold">Primary</div>
                  )}
                </div>
              ))}
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scientific Name</label>
              <input 
                type="text" 
                placeholder="Genus species"
                value={formData.scientificName || ''} 
                onChange={e => setFormData({...formData, scientificName: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg italic text-sm" 
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Family</label>
              <input 
                type="text" 
                placeholder="Family"
                value={formData.family || ''} 
                onChange={e => setFormData({...formData, family: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specific Locality Details</label>
              <textarea 
                placeholder="Near the junction of Hwy 1 and Main St..."
                value={formData.localityDescription || ''} 
                onChange={e => setFormData({...formData, localityDescription: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg h-16 text-sm" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lat/Lng</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Lat"
                  value={formData.latitude || ''} 
                  onChange={e => setFormData({...formData, latitude: e.target.value})}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                />
                <input 
                  type="text" 
                  placeholder="Lng"
                  value={formData.longitude || ''} 
                  onChange={e => setFormData({...formData, longitude: e.target.value})}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full text-xs" onClick={getLocation}>
                Get Coordinates
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
