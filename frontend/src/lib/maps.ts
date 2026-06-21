import type { Place } from "../types";

export function externalMapUrl(place: Pick<Place, "lat" | "lon" | "title">): string {
  const query = encodeURIComponent(`${place.title} ${place.lat},${place.lon}`);
  return `https://www.openstreetmap.org/search?query=${query}#map=18/${place.lat}/${place.lon}`;
}
