import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { usePositions } from "../features/map/hooks/usePositions";

export default function MapView() {
  const { positions } = usePositions();

  return (
    <MapContainer
      center={[0, 0]}
      zoom={10}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        url="https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png"
        attribution="Map data © OpenPlanetary"
      />
      {positions?.rover && (
        <Marker position={[positions.rover.y, positions.rover.x]}>
          <Popup>
            Pressurized Rover: {positions.rover.x}, {positions.rover.y}
          </Popup>
        </Marker>
      )}
      {positions?.eva &&
        positions.eva.map((e, i) => (
          <Marker key={i} position={[e.y, e.x]}>
            <Popup>
              EVA {i + 1}: {e.x}, {e.y}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
