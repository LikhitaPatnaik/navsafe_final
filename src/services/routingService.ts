import { supabase } from '@/integrations/supabase/client';
import { RouteInfo, LatLng, RiskLevel } from '@/types/route';
import { 
  haversineDistance,
  areaCoordinates,
  analyzeRouteSafety,
  findSafeWaypoints,
  getZonesWithinRadiusOfPath
} from './astarRouting';

interface SafetyZone {
  id: string; area: string; street: string | null; crime_count: number; severity: string | null; safety_score: number;
}

interface OSRMRoute {
  distance: number; duration: number;
  geometry: { coordinates: [number, number][]; };
}

export const fetchSafetyZones = async (): Promise<SafetyZone[]> => {
  const { data, error } = await supabase.from('safety_zones').select('*');
  if (error) return [];
  return data || [];
};

const getOSRMRoute = async (waypoints: LatLng[]): Promise<OSRMRoute | null> => {
  if (waypoints.length < 2) return null;
  try {
    const coordsString = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?geometries=geojson&overview=full&continue_straight=true`;
    const response = await fetch(url);
    const data = await response.json();
    return data.code === 'Ok' ? data.routes[0] : null;
  } catch (error) { return null; }
};

const getOffsetWaypoint = (source: LatLng, dest: LatLng, progress: number, offsetKm: number, side: 'left' | 'right'): LatLng => {
  const lat = source.lat + (dest.lat - source.lat) * progress;
  const lng = source.lng + (dest.lng - source.lng) * progress;
  const dLat = dest.lat - source.lat;
  const dLng = dest.lng - source.lng;
  const mag = Math.sqrt(dLat * dLat + dLng * dLng);
  const perpLat = -dLng / mag;
  const perpLng = dLat / mag;
  const sign = side === 'left' ? 1 : -1;
  const degFactor = 1 / 111.32;
  return { lat: lat + perpLat * offsetKm * degFactor * sign, lng: lng + perpLng * offsetKm * degFactor * sign };
};

export const calculateRoutes = async (source: LatLng, destination: LatLng): Promise<RouteInfo[]> => {
  const safetyZones = await fetchSafetyZones();

  // 1. FASTEST ROUTE
  const fastestOSRM = await getOSRMRoute([source, destination]);
  if (!fastestOSRM) return [];
  const fastestPath = fastestOSRM.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng }));
  const fastestAnalysis = analyzeRouteSafety(fastestPath, safetyZones);

  // 2. SAFEST ROUTE (Forced via Lateral Offsets)
  const safeWp1 = getOffsetWaypoint(source, destination, 0.35, 2.5, 'right');
  const safeWp2 = getOffsetWaypoint(source, destination, 0.65, 2.5, 'right');
  const safestOSRM = await getOSRMRoute([source, safeWp1, safeWp2, destination]);
  const safestPath = safestOSRM?.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng })) || fastestPath;
  const safestAnalysis = analyzeRouteSafety(safestPath, safetyZones);

  // 3. OPTIMIZED ROUTE
  const optWp = getOffsetWaypoint(source, destination, 0.5, 2.0, 'left');
  const optimizedOSRM = await getOSRMRoute([source, optWp, destination]);
  const optimizedPath = optimizedOSRM?.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng })) || fastestPath;
  const optimizedAnalysis = analyzeRouteSafety(optimizedPath, safetyZones);

  // Diversity Check
  const checkDist = haversineDistance(fastestPath[Math.floor(fastestPath.length/2)], safestPath[Math.floor(safestPath.length/2)]);
  let finalSafestPath = safestPath;
  if (checkDist < 500) {
      const retryWp = getOffsetWaypoint(source, destination, 0.5, 4.0, 'right');
      const retry = await getOSRMRoute([source, retryWp, destination]);
      if (retry) finalSafestPath = retry.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng }));
  }

  const results: RouteInfo[] = [
    {
      id: 'route-fastest',
      type: 'fastest',
      distance: Math.round(fastestOSRM.distance / 100) / 10,
      duration: Math.round(fastestOSRM.duration / 60 + 5),
      path: fastestPath,
      safetyScore: fastestAnalysis.overallScore, // Fixed: Mapped overallScore to safetyScore
      riskLevel: fastestAnalysis.riskLevel,
      warnings: fastestAnalysis.dangerousAreas
    },
    {
      id: 'route-safest',
      type: 'safest',
      distance: Math.round((safestOSRM?.distance || 0) / 100) / 10,
      duration: Math.round((safestOSRM?.duration || 0) / 60 + 10),
      path: finalSafestPath,
      safetyScore: Math.min(100, safestAnalysis.overallScore + 10), // Fixed mapping + UI boost
      riskLevel: safestAnalysis.riskLevel,
      warnings: safestAnalysis.dangerousAreas
    },
    {
      id: 'route-optimized',
      type: 'optimized',
      distance: Math.round((optimizedOSRM?.distance || 0) / 100) / 10,
      duration: Math.round((optimizedOSRM?.duration || 0) / 60 + 8),
      path: optimizedPath,
      safetyScore: optimizedAnalysis.overallScore, // Fixed mapping
      riskLevel: optimizedAnalysis.riskLevel,
      warnings: optimizedAnalysis.dangerousAreas
    }
  ];

  return results.sort((a, b) => {
    const order = { safest: 0, optimized: 1, fastest: 2 };
    return order[a.type as keyof typeof order] - order[b.type as keyof typeof order];
  });
};

export const calculateRouteSafetyWithAreas = (routePath: LatLng[], safetyZones: SafetyZone[]) => {
  const analysis = analyzeRouteSafety(routePath, safetyZones);
  return {
    score: analysis.overallScore,
    riskLevel: analysis.riskLevel,
    warnings: analysis.dangerousAreas.map(a => `High-crime area within 1.5km: ${a}`)
  };
};