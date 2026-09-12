"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { fetchApi } from "@/lib/api";

export interface CCTVMarkerItem {
  id: number;
  lokasi: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  type?: string | null;
  camera_type?: string | null;
  stream_url?: string | null;
}

interface LeafletMapProps {
  cctvMarkers?: CCTVMarkerItem[];
  boundariesGeojson?: any;
  selectedCCTVId?: number | null;
  onSelectCCTV?: (cctv: CCTVMarkerItem) => void;
  className?: string;
  height?: string;
}

const WARNA_KECAMATAN = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4",
  "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff"
];

export function LeafletMap({
  cctvMarkers: externalMarkers,
  boundariesGeojson: externalGeojson,
  selectedCCTVId,
  onSelectCCTV,
  className = "",
  height = "100%",
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: number]: any }>({});

  const [internalMarkers, setInternalMarkers] = useState<CCTVMarkerItem[]>(externalMarkers || []);
  const [internalGeojson, setInternalGeojson] = useState<any>(externalGeojson || null);

  // Auto-fetch if not provided
  useEffect(() => {
    if (!externalMarkers || !externalGeojson) {
      fetchApi<any>("/api/v1/gis/map_data").then((res) => {
        if (res.success && res.data) {
          if (!externalMarkers && res.data.cctv_markers) {
            setInternalMarkers(res.data.cctv_markers);
          }
          if (!externalGeojson && res.data.geojson_boundaries) {
            setInternalGeojson(res.data.geojson_boundaries);
          }
        }
      });
    }
  }, [externalMarkers, externalGeojson]);

  useEffect(() => {
    if (externalMarkers) setInternalMarkers(externalMarkers);
  }, [externalMarkers]);

  useEffect(() => {
    if (externalGeojson) setInternalGeojson(externalGeojson);
  }, [externalGeojson]);

  // Initialize Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isSubscribed = true;

    import("leaflet").then((L) => {
      if (!isSubscribed || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default Kota Bogor
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        preferCanvas: true,
      }).setView([-6.5971, 106.8060], 13);
      mapInstanceRef.current = map;

      // Free OpenStreetMap Tiles with Dark Mode Styling (No API Key Required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: "map-tiles-dark",
      }).addTo(map);

      // Render GeoJSON Boundaries with color mapping
      if (internalGeojson && internalGeojson.features && internalGeojson.features.length > 0) {
        L.geoJSON(internalGeojson, {
          style: (feature) => {
            const index = internalGeojson.features.indexOf(feature);
            const color = WARNA_KECAMATAN[index % WARNA_KECAMATAN.length] || "#6366f1";
            return {
              color: color,
              weight: 2,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.12,
            };
          },
          onEachFeature: (feature, layer) => {
            const nama = feature.properties?.nama || feature.properties?.name || "Wilayah";
            layer.bindPopup(
              `<div style="color:#0f172a; font-family:sans-serif; font-size:12px; font-weight:bold; padding:4px;">
                Batas Administratif: ${nama}
              </div>`
            );
          },
        }).addTo(map);
      }

      // Render Markers
      markersRef.current = {};
      (internalMarkers || []).forEach((c) => {
        if (typeof c.latitude !== "number" || typeof c.longitude !== "number") return;

        const isAktif = (c.status || "").toLowerCase() === "aktif";
        const color = isAktif ? "#10b981" : "#ef4444";
        const type = (c.type || "CCTV").toUpperCase();

        const customIcon = L.divIcon({
          className: "custom-pin",
          html: `
            <div style="
              background-color: ${color};
              width: 14px;
              height: 14px;
              border-radius: 50%;
              border: 2px solid #ffffff;
              box-shadow: 0 0 10px ${color};
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([c.latitude, c.longitude], { icon: customIcon }).addTo(map);
        markersRef.current[c.id] = marker;

        marker.bindPopup(`
          <div style="color:#0f172a; font-family:sans-serif; padding:4px; min-width:140px;">
            <p style="font-weight:bold; font-size:12px; margin:0 0 2px 0; color:#1e293b;">${c.lokasi}</p>
            <p style="font-size:10px; margin:0; color:#64748b;">Tipe: <b>${type}</b></p>
            <p style="font-size:10px; margin:2px 0 0 0;">
              Status: <span style="font-weight:bold; color:${color}; text-transform:uppercase;">${c.status}</span>
            </p>
          </div>
        `);

        if (onSelectCCTV) {
          marker.on("click", () => {
            onSelectCCTV(c);
          });
        }
      });
    });

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [internalMarkers, internalGeojson]);

  // Center on selected CCTV
  useEffect(() => {
    if (!selectedCCTVId || !mapInstanceRef.current) return;

    const target = (internalMarkers || []).find((c) => c.id === selectedCCTVId);
    if (target && typeof target.latitude === "number" && typeof target.longitude === "number") {
      mapInstanceRef.current.flyTo([target.latitude, target.longitude], 15, {
        duration: 1.2,
      });

      const marker = markersRef.current[selectedCCTVId];
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedCCTVId, internalMarkers]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height }}
      className={`w-full relative z-10 ${className}`}
    />
  );
}

export default LeafletMap;
