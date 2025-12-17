
import React, { useState, useRef } from 'react';
import Button from './Button';
import { SpecimenFormData } from '../types';
import { extractSpecimenData } from '../services/geminiService';

interface SpecimenFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const SpecimenForm: React.FC<SpecimenFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<SpecimenFormData>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setFormData(prev => ({ ...prev, image: file }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanLabel = async () => {
    if (!imagePreview) return;
    setIsScanning(true);
    try {
      const base64 = imagePreview.split(',')[1];
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
    if (!imagePreview) {
      alert("Please upload an image of the specimen.");
      return;
    }
    onSubmit({ ...formData, imageUrl: imagePreview });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-5xl mx-auto border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 serif">Register New Specimen</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image Upload & Preview */}
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[3/4] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all bg-slate-50 overflow-hidden relative"
          >
            {imagePreview ? (
              <img src={imagePreview} className="w-full h-full object-contain" alt="Preview" />
            ) : (
              <>
                <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-500 font-medium text-center px-4">Click to upload specimen image</p>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              className="hidden" 
              accept="image/*"
            />
          </div>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleScanLabel}
            isLoading={isScanning}
            disabled={!imagePreview}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Auto-Extract Label Data (AI)
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
            <Button type="submit" variant="primary" className="flex-1">Save Specimen</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpecimenForm;
