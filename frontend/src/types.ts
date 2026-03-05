export interface ISSPosition {
  message: string;
  iss_position: {
    latitude: string;
    longitude: string;
  };
  timestamp: number;
}

export interface AstronautInfo {
  craft: string;
  name: string;
}

export interface ISSCrew {
  message: string;
  number: number;
  people: AstronautInfo[];
}

export interface APODData {
  copyright?: string;
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: string;
  service_version: string;
  title: string;
  url: string;
}

export interface EventGeometry {
  magnitudeValue?: number;
  magnitudeUnit?: string;
  date: string;
  type: string;
  coordinates: number[] | number[][];
}

export interface EarthEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  closed: string | null;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: EventGeometry[];
}

export interface EarthEventsResponse {
  title: string;
  description: string;
  link: string;
  events: EarthEvent[];
}
