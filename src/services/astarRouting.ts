import { LatLng, RiskLevel } from '@/types/route';

export interface SafetyZone {
  id: string;
  area: string;
  street: string | null;
  crime_count: number;
  severity: string | null;
  safety_score: number;
}

// Haversine distance in meters
export const haversineDistance = (p1: LatLng, p2: LatLng): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Map known Visakhapatnam areas to accurate coordinates
export const areaCoordinates: Record<string, LatLng> = {
  'Anakapalle NH16': { lat: 17.6913, lng: 83.0039 },
  'One Town Heritage': { lat: 17.7000, lng: 83.2900 },
  'One Town': { lat: 17.7000, lng: 83.2900 },
  'Jagadamba Jct': { lat: 17.7105, lng: 83.2980 },
  'Jagadamba Junction': { lat: 17.7105, lng: 83.2980 },
  'Pendurthi Vepagunta': { lat: 17.7977, lng: 83.1943 },
  'Pendurthi': { lat: 17.7977, lng: 83.1943 },
  'RK Beach South': { lat: 17.7180, lng: 83.3250 },
  'RK Beach': { lat: 17.7180, lng: 83.3250 },
  'Beach Road': { lat: 17.7215, lng: 83.3150 },
  'NAD Flyover Zone': { lat: 17.7400, lng: 83.2300 },
  'NAD Junction': { lat: 17.7400, lng: 83.2300 },
  'Dwaraka Nagar Hub': { lat: 17.7287, lng: 83.3086 },
  'Dwaraka Nagar': { lat: 17.7287, lng: 83.3086 },
  'Rushikonda North': { lat: 17.7920, lng: 83.3850 },
  'Rushikonda': { lat: 17.7920, lng: 83.3850 },
  'Kancharapalem Core': { lat: 17.7354, lng: 83.2738 },
  'Kancharapalem': { lat: 17.7354, lng: 83.2738 },
  'Arilova': { lat: 17.7673, lng: 83.3134 },
  'Gajuwaka Industrial': { lat: 17.6853, lng: 83.2037 },
  'Gajuwaka': { lat: 17.6853, lng: 83.2037 },
  'Maddilapalem Jct': { lat: 17.7382, lng: 83.3230 },
  'Maddilapalem': { lat: 17.7382, lng: 83.3230 },
  'Old Gajuwaka': { lat: 17.6850, lng: 83.2040 },
  'Marripalem': { lat: 17.7400, lng: 83.2500 },
  'Lawsons Bay Colony': { lat: 17.7300, lng: 83.3300 },
  'Anandapuram Bypass': { lat: 17.9000, lng: 83.3700 },
  'Akkayapalem Central': { lat: 17.7347, lng: 83.2977 },
  'Anakapalli': { lat: 17.6890, lng: 83.0035 },
  'MVP Colony': { lat: 17.7407, lng: 83.3367 },
  'Madhurawada Hub': { lat: 17.8017, lng: 83.3533 },
  'Madhurawada': { lat: 17.8017, lng: 83.3533 },
  'Bheemunipatnam': { lat: 17.8900, lng: 83.4500 },
  'Sheelanagar': { lat: 17.7185, lng: 83.1984 },
  'Simhachalam Ghat': { lat: 17.7669, lng: 83.2484 },
  'Steel Plant': { lat: 17.6100, lng: 83.1900 },
  'PM Palem': { lat: 17.7990, lng: 83.3531 },
  'Seethammadhara': { lat: 17.7425, lng: 83.3124 },
  'Siripuram': { lat: 17.7198, lng: 83.3163 },
  'Dabagardens': { lat: 17.7150, lng: 83.3050 },
  'Kommadi': { lat: 17.8306, lng: 83.3358 },
  'RTC Complex': { lat: 17.7200, lng: 83.3100 },
  'Yendada': { lat: 17.7772, lng: 83.3628 },
  'Boyapalem': { lat: 17.7312, lng: 83.2859 },
  'Vishalakshinagar': { lat: 17.7350, lng: 83.3200 },
  'Venkojipalem': { lat: 17.7456, lng: 83.3289 },
};

// CRITICAL: Identifies ALL safety zones within exactly 1.5km of the road path
export const getZonesWithinRadiusOfPath = (
  path: LatLng[],
  safetyZones: SafetyZone[],
  radiusMeters: number = 1500
): SafetyZone[] => {
  const zonesInRadius = new Set<SafetyZone>();
  const sampleRate = Math.max(1, Math.floor(path.length / 50));

  for (let i = 0; i < path.length; i += sampleRate) {
    const point = path[i];
    for (const zone of safetyZones) {
      const coords = areaCoordinates[zone.area] || Object.values(areaCoordinates).find(c => 
        Math.abs(c.lat - point.lat) < 0.015 && Math.abs(c.lng - point.lng) < 0.015
      );

      if (coords && haversineDistance(point, coords) <= radiusMeters) {
        zonesInRadius.add(zone);
      }
    }
  }
  return Array.from(zonesInRadius);
};

export const getNearestSafetyZone = (point: LatLng, safetyZones: SafetyZone[]) => {
  if (safetyZones.length === 0) return null;
  let nearestZone: SafetyZone | null = null;
  let nearestDistance = Infinity;

  for (const zone of safetyZones) {
    const normalizedArea = zone.area.toLowerCase();
    let zoneCenter: LatLng | null = null;
    for (const [key, coords] of Object.entries(areaCoordinates)) {
      if (key.toLowerCase() === normalizedArea || normalizedArea.includes(key.toLowerCase())) {
        zoneCenter = coords;
        break;
      }
    }
    if (!zoneCenter) continue;
    const distance = haversineDistance(point, zoneCenter);
    if (distance < 2000 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }
  return nearestZone ? { safetyScore: nearestZone.safety_score, areaName: nearestZone.area } : null;
};

export const getSafetyScoreForPoint = (point: LatLng, safetyZones: SafetyZone[]) => {
  const nearest = getNearestSafetyZone(point, safetyZones);
  return nearest ? nearest.safetyScore : 70;
};

export const findSafeWaypoints = (source: LatLng, destination: LatLng, safetyZones: SafetyZone[], excludePath: LatLng[] = []) => {
  const directDistance = haversineDistance(source, destination);
  const candidates = safetyZones.filter(z => z.safety_score >= 80);
  const validWaypoints: LatLng[] = [];

  for (const zone of candidates) {
    const coords = areaCoordinates[zone.area];
    if (!coords) continue;
    if (haversineDistance(source, coords) + haversineDistance(coords, destination) < directDistance * 1.6) {
      let tooClose = false;
      for (let i = 0; i < excludePath.length; i += 20) {
        if (haversineDistance(coords, excludePath[i]) < 800) { tooClose = true; break; }
      }
      if (!tooClose) validWaypoints.push(coords);
    }
  }
  return validWaypoints.sort((a, b) => getSafetyScoreForPoint(b, safetyZones) - getSafetyScoreForPoint(a, safetyZones)).slice(0, 2);
};

export const analyzeRouteSafety = (
  path: LatLng[],
  safetyZones: SafetyZone[]
): {
  overallScore: number;
  riskLevel: RiskLevel;
  dangerousAreas: string[];
  safeAreas: string[];
} => {
  const activeZones = getZonesWithinRadiusOfPath(path, safetyZones, 1500);
  const dangerousAreas = activeZones.filter(z => z.safety_score < 50).map(z => z.area);
  const safeAreas = activeZones.filter(z => z.safety_score >= 80).map(z => z.area);
  
  const avgScore = activeZones.length > 0 
    ? activeZones.reduce((sum, z) => sum + z.safety_score, 0) / activeZones.length 
    : 70;

  return {
    overallScore: Math.round(avgScore),
    riskLevel: avgScore >= 70 ? 'safe' : avgScore >= 50 ? 'moderate' : 'risky',
    dangerousAreas: Array.from(new Set(dangerousAreas)),
    safeAreas: Array.from(new Set(safeAreas)),
  };
};

export const calculatePathDistance = (path: LatLng[]): number => {
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += haversineDistance(path[i - 1], path[i]);
  return distance;
};

//astarRouting.ts 23:31