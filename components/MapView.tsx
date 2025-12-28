import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Specimen } from '../types';
import SpecimenPopup from './SpecimenPopup';

interface MapViewProps {
  specimens: Specimen[];
  selectedSpecimenId: string | null;
  onSelectSpecimen: (id: string | null) => void;
}

// Custom marker icons
const createDefaultIcon = () =>
  L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const createSelectedIcon = () =>
  L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [35, 57],
    iconAnchor: [17, 57],
    popupAnchor: [1, -44],
    shadowSize: [41, 41],
  });

// Component to handle map initialization and centering
const MapController: React.FC<{
  selectedSpecimenId: string | null;
  specimens: Specimen[];
  initialBounds: L.LatLngBoundsExpression | null;
}> = ({ selectedSpecimenId, specimens, initialBounds }) => {
  const map = useMap();
  const isInitialized = useRef(false);

  // Fix map size and fit bounds on initial load
  useEffect(() => {
    if (!isInitialized.current) {
      // Small delay to ensure container is fully rendered
      setTimeout(() => {
        map.invalidateSize();
        if (initialBounds) {
          map.fitBounds(initialBounds, { padding: [50, 50] });
        }
        isInitialized.current = true;
      }, 100);
    }
  }, [map, initialBounds]);

  // Handle specimen selection
  useEffect(() => {
    if (selectedSpecimenId) {
      const specimen = specimens.find((s) => s.id === selectedSpecimenId);
      if (specimen?.locality.latitude && specimen?.locality.longitude) {
        map.flyTo([specimen.locality.latitude, specimen.locality.longitude], 12, {
          duration: 1,
        });
      }
    }
  }, [selectedSpecimenId, specimens, map]);

  return null;
};

const MapView: React.FC<MapViewProps> = ({ specimens, selectedSpecimenId, onSelectSpecimen }) => {
  // Filter specimens with valid coordinates
  const validSpecimens = useMemo(
    () =>
      specimens.filter(
        (s) => s.locality.latitude != null && s.locality.longitude != null
      ),
    [specimens]
  );

  // Calculate default center and bounds
  const mapSettings = useMemo(() => {
    if (validSpecimens.length === 0) {
      return null;
    }

    const coords = validSpecimens.map(
      (s) => [s.locality.latitude!, s.locality.longitude!] as [number, number]
    );

    if (coords.length === 1) {
      return {
        center: coords[0],
        zoom: 10,
        bounds: null,
      };
    }

    // Use average center
    const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    return {
      center: [avgLat, avgLng] as [number, number],
      zoom: 2,
      bounds: coords as L.LatLngBoundsExpression,
    };
  }, [validSpecimens]);

  const defaultIcon = useMemo(() => createDefaultIcon(), []);
  const selectedIcon = useMemo(() => createSelectedIcon(), []);

  if (!mapSettings) {
    return (
      <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
          <svg
            className="w-16 h-16 text-slate-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Location Data</h3>
          <p className="text-sm text-slate-500">
            None of the filtered specimens have geographic coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <MapContainer
        center={mapSettings.center}
        zoom={mapSettings.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validSpecimens.map((specimen) => (
          <Marker
            key={specimen.id}
            position={[specimen.locality.latitude!, specimen.locality.longitude!]}
            icon={selectedSpecimenId === specimen.id ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: () => onSelectSpecimen(specimen.id),
            }}
          >
            <Popup>
              <SpecimenPopup specimen={specimen} />
            </Popup>
          </Marker>
        ))}

        <MapController
          selectedSpecimenId={selectedSpecimenId}
          specimens={validSpecimens}
          initialBounds={mapSettings.bounds}
        />
      </MapContainer>
    </div>
  );
};

export default MapView;
