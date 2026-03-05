import axios from "axios";
import { ISSPosition, ISSCrew, APODData, EarthEventsResponse } from "./types";

const api = axios.create({ baseURL: "/api" });

export const fetchISSPosition = (): Promise<ISSPosition> =>
  api.get<ISSPosition>("/iss/position/").then((r) => r.data);

export const fetchISSCrew = (): Promise<ISSCrew> =>
  api.get<ISSCrew>("/iss/crew/").then((r) => r.data);

export const fetchAPOD = (date?: string): Promise<APODData> =>
  api
    .get<APODData>("/nasa/apod/", { params: date ? { date } : {} })
    .then((r) => r.data);

export const fetchEarthEvents = (
  days = 30,
  limit = 50
): Promise<EarthEventsResponse> =>
  api
    .get<EarthEventsResponse>("/earth/events/", { params: { days, limit } })
    .then((r) => r.data);
