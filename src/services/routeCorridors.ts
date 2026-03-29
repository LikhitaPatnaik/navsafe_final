import { LatLng } from '@/types/route';
import { haversineDistance } from './astarRouting';

export interface CorridorBlueprint {
  id: string;
  label: string;
  waypoints: LatLng[];
}

const corridorNodes = {
  // --- North & Anandapuram ---
  anandapuram: { lat: 17.9218, lng: 83.3512 },
  anandapuramBypass: { lat: 17.8980, lng: 83.3680 },
  bheemiliBeach: { lat: 17.8900, lng: 83.4550 },
  tagarapuvalasa: { lat: 17.9330, lng: 83.4258 },
  
  // --- Madhurawada & IT Region ---
  kommadi: { lat: 17.8306, lng: 83.3358 },
  marikavalasa: { lat: 17.8359, lng: 83.3581 },
  itSezRoad: { lat: 17.8040, lng: 83.3560 },
  madhurawada: { lat: 17.8017, lng: 83.3533 },
  pmPalem: { lat: 17.7990, lng: 83.3531 },
  yendada: { lat: 17.7772, lng: 83.3628 },
  rushikonda: { lat: 17.7820, lng: 83.3850 },

  // --- Central & Health City ---
  hanumanthawaka: { lat: 17.7570, lng: 83.3330 },
  isukathota: { lat: 17.7470, lng: 83.3280 },
  mvpColony: { lat: 17.7400, lng: 83.3320 },
  siripuram: { lat: 17.7210, lng: 83.3150 },
  rtcComplex: { lat: 17.7275, lng: 83.3000 },
  teluguThalliFlyover: { lat: 17.7230, lng: 83.2970 },
  
  // --- Simhachalam & Port ---
  simhachalam: { lat: 17.7660, lng: 83.2500 },
  adavivaram: { lat: 17.7750, lng: 83.2850 },
  conventJunction: { lat: 17.7010, lng: 83.2840 },
  portMainRoad: { lat: 17.6950, lng: 83.2750 },
  scindia: { lat: 17.6820, lng: 83.2650 },

  // --- South & Anakapalli ---
  sheelanagar: { lat: 17.7120, lng: 83.2350 },
  gajuwaka: { lat: 17.6905, lng: 83.2091 },
  kurmannapalem: { lat: 17.6750, lng: 83.1550 },
  lankelapalem: { lat: 17.6650, lng: 83.1150 },
  anakapalli: { lat: 17.6895, lng: 83.0024 },
} as const;

// Helper to clean up waypoints
const dedupeWaypoints = (points: LatLng[]) =>
  points.reduce<LatLng[]>((acc, point) => {
    const alreadyIncluded = acc.some((existing) => haversineDistance(existing, point) < 200);
    if (!alreadyIncluded) acc.push(point);
    return acc;
  }, []);

const orderWaypointsFromSource = (source: LatLng, points: LatLng[]) =>
  [...points].sort((a, b) => haversineDistance(source, a) - haversineDistance(source, b));

const normalizeWaypoints = (source: LatLng, destination: LatLng, points: LatLng[]) => {
  const filtered = points.filter(
    (point) => haversineDistance(source, point) > 300 && haversineDistance(destination, point) > 300,
  );
  return dedupeWaypoints(orderWaypointsFromSource(source, filtered));
};

const isValidVizagTrip = (source: LatLng, destination: LatLng) => {
  const directDistance = haversineDistance(source, destination);
  const allNodes = Object.values(corridorNodes);
  
  // Checks if trip is near any defined corridor node
  const sourceNearCorridor = allNodes.some((node) => haversineDistance(source, node) <= 6000);
  const destinationNearCorridor = allNodes.some((node) => haversineDistance(destination, node) <= 6000);

  // Expanded distance range to cover Anakapalli to Anandapuram (~55km)
  return sourceNearCorridor && destinationNearCorridor && directDistance >= 1500 && directDistance <= 60000;
};

export const getPreferredRoadCorridors = (source: LatLng, destination: LatLng): CorridorBlueprint[] => {
  if (!isValidVizagTrip(source, destination)) {
    return [];
  }

  const blueprints: Array<{ id: string; label: string; points: LatLng[] }> = [
    {
      id: 'vsp-anandapuram-main',
      label: 'Visakhapatnam Anandapuram Main Road',
      points: [corridorNodes.hanumanthawaka, corridorNodes.pmPalem, corridorNodes.madhurawada, corridorNodes.anandapuram],
    },
    {
      id: 'nh16-service-road',
      label: 'NH16 Service Road',
      points: [corridorNodes.isukathota, corridorNodes.pmPalem, corridorNodes.itSezRoad],
    },
    {
      id: 'port-main-road',
      label: 'Port Main Road',
      points: [corridorNodes.conventJunction, corridorNodes.portMainRoad, corridorNodes.scindia, corridorNodes.sheelanagar],
    },
    {
      id: 'simhachalam-brts-road',
      label: 'Simhachalam Hanumanthawaka Road',
      points: [corridorNodes.simhachalam, corridorNodes.adavivaram, corridorNodes.hanumanthawaka],
    },
    {
      id: 'telugu-thalli-flyover',
      label: 'Telugu Thalli Flyover',
      points: [corridorNodes.rtcComplex, corridorNodes.teluguThalliFlyover, corridorNodes.conventJunction],
    },
    {
      id: 'anakapalli-vsp-road',
      label: 'Anakapalli - VSP Road',
      points: [corridorNodes.anakapalli, corridorNodes.lankelapalem, corridorNodes.kurmannapalem, corridorNodes.gajuwaka],
    },
    {
      id: 'anakapalli-vsp-anandapuram',
      label: 'Anakapalli - Anandapuram Highway',
      points: [corridorNodes.anakapalli, corridorNodes.sheelanagar, corridorNodes.hanumanthawaka, corridorNodes.anandapuram],
    },
    {
      id: 'beach-road',
      label: 'Beach Road (Coastal)',
      points: [corridorNodes.siripuram, corridorNodes.mvpColony, corridorNodes.rushikonda, corridorNodes.bheemiliBeach],
    },
  ];

  return blueprints
    .map((blueprint) => ({
      id: blueprint.id,
      label: blueprint.label,
      waypoints: normalizeWaypoints(source, destination, blueprint.points),
    }))
    .filter((blueprint) => blueprint.waypoints.length > 0);
};