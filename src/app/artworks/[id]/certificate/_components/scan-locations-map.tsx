'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

type ScanCoordinate = {
  latitude: number;
  longitude: number;
  scanned_at: string;
  formatted?: string;
  city?: string;
  country?: string;
};

type ScanLocationsMapProps = {
  locations: ScanCoordinate[];
};

type GroupedMarker = {
  latitude: number;
  longitude: number;
  scans: ScanCoordinate[];
};

const GROUPING_PRESETS = {
  precise: 5,
  nearby: 4,
  city: 2,
} as const;

type GroupingMode = keyof typeof GROUPING_PRESETS;

const defaultMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitMapBounds({ locations }: { locations: GroupedMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      return;
    }

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 12);
      return;
    }

    const bounds = L.latLngBounds(
      locations.map((location) => [location.latitude, location.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [locations, map]);

  return null;
}

export function ScanLocationsMap({ locations }: ScanLocationsMapProps) {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('nearby');

  const markers = useMemo(
    () => {
      const validLocations = locations.filter(
        (location) =>
          Number.isFinite(location.latitude) &&
          Number.isFinite(location.longitude) &&
          Math.abs(location.latitude) <= 90 &&
          Math.abs(location.longitude) <= 180,
      );

      const grouped = new Map<string, ScanCoordinate[]>();
      const precision = GROUPING_PRESETS[groupingMode];

      validLocations.forEach((location) => {
        const key = `${location.latitude.toFixed(precision)}:${location.longitude.toFixed(precision)}`;
        const existingGroup = grouped.get(key);
        if (existingGroup) {
          existingGroup.push(location);
          return;
        }

        grouped.set(key, [location]);
      });

      return Array.from(grouped.values())
        .map((scans) => {
          const sortedScans = [...scans].sort(
            (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime(),
          );
          const centerLatitude =
            scans.reduce((sum, scan) => sum + scan.latitude, 0) / scans.length;
          const centerLongitude =
            scans.reduce((sum, scan) => sum + scan.longitude, 0) / scans.length;

          return {
            latitude: centerLatitude,
            longitude: centerLongitude,
            scans: sortedScans,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.scans[0].scanned_at).getTime() -
            new Date(a.scans[0].scanned_at).getTime(),
        );
    },
    [groupingMode, locations],
  );

  if (markers.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-ink/60 font-serif">
          Grouping: {markers.length} marker{markers.length === 1 ? '' : 's'}
        </p>
        <label className="text-xs text-ink/70 font-serif flex items-center gap-2">
          Radius
          <select
            value={groupingMode}
            onChange={(event) => setGroupingMode(event.target.value as GroupingMode)}
            className="border border-wine/30 rounded bg-white px-2 py-1 text-xs text-ink"
          >
            <option value="precise">Precise</option>
            <option value="nearby">Nearby</option>
            <option value="city">City-level</option>
          </select>
        </label>
      </div>

      <div className="w-full h-64 sm:h-72 md:h-80 overflow-hidden rounded border border-wine/30">
        <MapContainer
          center={[markers[0].latitude, markers[0].longitude]}
          zoom={10}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitMapBounds locations={markers} />
          {markers.map((marker, index) => (
            <Marker
              key={`${marker.latitude}-${marker.longitude}-${index}`}
              position={[marker.latitude, marker.longitude]}
              icon={defaultMarkerIcon}
            >
              <Popup>
                <p className="font-semibold mb-1">
                  {marker.scans.length} ping{marker.scans.length === 1 ? '' : 's'}
                </p>
                <p className="font-semibold mb-1">
                  Latest:{' '}
                  {new Date(marker.scans[0].scanned_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p>
                  {marker.scans[0].formatted ||
                    `${marker.scans[0].city || ''}${marker.scans[0].city && marker.scans[0].country ? ', ' : ''}${marker.scans[0].country || ''}`.trim() ||
                    `Lat: ${marker.latitude.toFixed(4)}, Lng: ${marker.longitude.toFixed(4)}`}
                </p>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
