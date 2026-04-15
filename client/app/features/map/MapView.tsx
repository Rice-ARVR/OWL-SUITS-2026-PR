import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePositions } from "./hooks/usePositions";

// Fix for default markers in react-leaflet
import L from "leaflet";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export function MapView() {
  const { positions, error } = usePositions();

  const center: LatLngExpression = [0, 0];
  const zoom = 10;

  if (error) {
    return <div>Error loading map: {error}</div>;
  }

  return (
    <div style={{ height: "500px", width: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {positions && (
          <>
            <Marker position={[positions.rover.y, positions.rover.x]}>
              <Popup>
                Pressurized Rover
                <br />
                X: {positions.rover.x}, Y: {positions.rover.y}
              </Popup>
            </Marker>
            <Marker position={[positions.eva1.y, positions.eva1.x]}>
              <Popup>
                EVA 1<br />
                X: {positions.eva1.x}, Y: {positions.eva1.y}
              </Popup>
            </Marker>
            <Marker position={[positions.eva2.y, positions.eva2.x]}>
              <Popup>
                EVA 2<br />
                X: {positions.eva2.x}, Y: {positions.eva2.y}
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
