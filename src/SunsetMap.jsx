import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createSunsetArrow = (direction) => {
  const pointToSun = direction - 180;
  return L.divIcon({
    className: "sunset-arrow-icon",
    html: `<div class="arrow-wrapper">
            <div class="location-dot"></div>
            <div class="arrow" style="transform: rotate(${pointToSun}deg)">
              <div class="arrow-stem"></div>
              <div class="arrow-point"></div>
            </div>
            <div class="sun-icon">
              <div class="sun-circle"></div>
            </div>
          </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const MapClickHandler = ({ setSelectedLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleClick = (e) => {
      const { lat, lng } = e.latlng;
      setSelectedLocation({ lat, lng });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, setSelectedLocation]);

  return null;
};

function formatTime(isoTimeString) {
  if (!isoTimeString) return "Loading...";

  try {
    const date = new Date(isoTimeString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    console.error("Error formatting time:", err);
    return "Time format error";
  }
}

function formatDayLength(seconds) {
  if (!seconds && seconds !== 0) return "Unknown";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}h ${minutes}m ${secs}s`;
}

// (azimuth)
function calculateSunsetDirection(lat) {
  const now = new Date();
  const month = now.getMonth();

  let baseDirection = 270;

  const isSummerInNorth = month >= 3 && month <= 8;

  if (lat > 0) {
    // Northern hemisphere
    baseDirection += isSummerInNorth ? -15 : 15;
  } else {
    // Southern hemisphere
    baseDirection += isSummerInNorth ? 15 : -15;
  }

  if (Math.abs(lat) > 50) {
    baseDirection +=
      (lat > 0 ? -1 : 1) * Math.min(20, (Math.abs(lat) - 50) / 2);
  }

  return baseDirection;
}

function SunsetMap() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [sunsetDirection, setSunsetDirection] = useState(270);
  const [sunsetData, setSunsetData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedLocation) {
      setMarkerPosition([selectedLocation.lat, selectedLocation.lng]);

      const direction = calculateSunsetDirection(selectedLocation.lat);
      setSunsetDirection(direction);
      console.log("Sunset direction:", direction);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const fetchSunsetAndWeather = async () => {
      if (!selectedLocation) return;

      setLoading(true);
      setError(null);

      try {
        const sunsetResponse = await fetch(
          `https://api.sunrise-sunset.org/json?lat=${selectedLocation.lat.toFixed(4)}&lng=${selectedLocation.lng.toFixed(4)}&date=today&formatted=0`,
        );

        if (!sunsetResponse.ok) {
          throw new Error(
            `Failed to get sunset data: ${sunsetResponse.status}`,
          );
        }

        const sunsetResult = await sunsetResponse.json();

        if (sunsetResult.status !== "OK") {
          throw new Error(`Failed to get sunset data: ${sunsetResult.status}`);
        }

        //7Timer API
        const weatherResponse = await fetch(
          `https://www.7timer.info/bin/api.pl?lon=${selectedLocation.lng.toFixed(2)}&lat=${selectedLocation.lat.toFixed(2)}&product=astro&output=json`,
        );

        if (!weatherResponse.ok) {
          throw new Error(
            `Failed to get weather data: ${weatherResponse.status}`,
          );
        }

        const weatherResult = await weatherResponse.json();

        console.log("Sunset API Response:", sunsetResult);
        console.log("Weather API Response:", weatherResult);

        setSunsetData(sunsetResult.results);
        setWeatherData(weatherResult);
        setLoading(false);
      } catch (err) {
        console.error("API Error Details:", err);
        setError("Failed to fetch data. Please try again.");
        setLoading(false);
      }
    };

    fetchSunsetAndWeather();
  }, [selectedLocation]);

  const getCloudiness = () => {
    if (
      !weatherData ||
      !weatherData.dataseries ||
      weatherData.dataseries.length === 0
    ) {
      return null;
    }

    const cloudCover = weatherData.dataseries[0].cloudcover;

    const cloudPercentageMap = {
      1: 10,
      2: 25,
      3: 40,
      4: 50,
      5: 60,
      6: 75,
      7: 85,
      8: 95,
      9: 100,
    };

    return cloudPercentageMap[cloudCover] || 0;
  };

  const cloudiness = getCloudiness();

  const sunsetArrowIcon = markerPosition
    ? createSunsetArrow(sunsetDirection)
    : null;

  return (
    <div className="sunset-map-container">
      <h1 className="title-hues">Sky Fade</h1>
      <p>Click anywhere on the map to see sunset time and the sun's position</p>

      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapClickHandler setSelectedLocation={setSelectedLocation} />

        {markerPosition && (
          <Marker position={markerPosition} icon={sunsetArrowIcon}>
            <Popup>
              Sun position: {Math.round(sunsetDirection)}°
              {sunsetDirection > 265 && sunsetDirection < 275
                ? " (West)"
                : sunsetDirection >= 275 && sunsetDirection < 315
                  ? " (Northwest)"
                  : sunsetDirection >= 225 && sunsetDirection <= 265
                    ? " (Southwest)"
                    : ""}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {loading && <p>Loading data...</p>}
      {error && <p className="error">{error}</p>}

      {selectedLocation && sunsetData && !loading && (
        <div className="sunset-info">
          <h2>Sunset Information</h2>
          <p>
            <strong>Location:</strong> {selectedLocation.lat.toFixed(4)}°,{" "}
            {selectedLocation.lng.toFixed(4)}°
          </p>
          <p>
            <strong>Sunset Time:</strong> {formatTime(sunsetData.sunset)}
          </p>
          <p>
            <strong>Sunrise Time:</strong> {formatTime(sunsetData.sunrise)}
          </p>
          <p>
            <strong>Day Length:</strong>{" "}
            {formatDayLength(sunsetData.day_length)}
          </p>
          <p>
            <strong>Sun Position:</strong> {Math.round(sunsetDirection)}°
            {sunsetDirection > 265 && sunsetDirection < 275
              ? " (West)"
              : sunsetDirection >= 275 && sunsetDirection < 315
                ? " (Northwest)"
                : sunsetDirection >= 225 && sunsetDirection <= 265
                  ? " (Southwest)"
                  : ""}
          </p>
          {cloudiness !== null && (
            <div
              className="weather-info"
              style={{
                backgroundColor:
                  cloudiness < 20
                    ? "#e6ffed"
                    : cloudiness < 40
                      ? "#f0ffe0"
                      : cloudiness < 60
                        ? "#fff9e6"
                        : cloudiness < 80
                          ? "#fff1e0"
                          : "#ffebeb",
                borderRadius: "4px",
                padding: "15px",
                border:
                  cloudiness < 20
                    ? "1px solid #a1e5b4"
                    : cloudiness < 40
                      ? "1px solid #c6e0a5"
                      : cloudiness < 60
                        ? "1px solid #e6d292"
                        : cloudiness < 80
                          ? "1px solid #e6c092"
                          : "1px solid #e6a5a5",
                transition: "background-color 0.3s ease",
              }}
            >
              <h3>Weather Forecast at Sunset</h3>
              <p>
                <strong>Cloud Coverage:</strong> {cloudiness}%
                <span
                  className="cloud-indicator"
                  style={{
                    display: "inline-block",
                    width: `${cloudiness}%`,
                    height: "10px",
                    backgroundColor:
                      cloudiness < 20
                        ? "#4caf50"
                        : cloudiness < 40
                          ? "#8bc34a"
                          : cloudiness < 60
                            ? "#ffc107"
                            : cloudiness < 80
                              ? "#ff9800"
                              : "#f44336",
                    marginLeft: "10px",
                    borderRadius: "5px",
                  }}
                ></span>
              </p>
              <p>
                <strong>Visibility Probability:</strong> {100 - cloudiness}%
              </p>
              <p
                className="forecast-suggestion"
                style={{
                  backgroundColor:
                    cloudiness < 30
                      ? "#e8f5e9"
                      : cloudiness < 70
                        ? "#fff8e1"
                        : "#ffebee",
                }}
              >
                {cloudiness < 30
                  ? "Clear skies expected! Great conditions for viewing the sunset."
                  : cloudiness < 70
                    ? "Partially cloudy. You might get a beautiful sunset with cloud colors."
                    : "Mostly cloudy. The sunset might not be clearly visible."}
              </p>
            </div>
          )}
        </div>
      )}
      <footer className="escape-solutions-footer">
        <p>
          © {new Date().getFullYear()} Escape Solutions. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default SunsetMap;
