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
          `https://api.sunrise-sunset.org/json?lat=${selectedLocation.lat.toFixed(
            4,
          )}&lng=${selectedLocation.lng.toFixed(4)}&date=today&formatted=0`,
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
          `https://www.7timer.info/bin/api.pl?lon=${selectedLocation.lng.toFixed(
            2,
          )}&lat=${selectedLocation.lat.toFixed(2)}&product=astro&output=json`,
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

  function getSunPositionDescription(direction) {
    if (direction > 265 && direction < 275) return "West";
    if (direction >= 275 && direction < 315) return "Northwest";
    if (direction >= 225 && direction <= 265) return "Southwest";
    return "";
  }

  return (
    <div className="sunset-map-container">
      <div className="title-container">
        <h1 className="title-hues">Sky Fade</h1>
        <p className="app-description">
          Click anywhere on the map to see sunset time and the sun's position
        </p>
      </div>

      <MapContainer center={[0, 0]} zoom={2} className="map-container">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapClickHandler setSelectedLocation={setSelectedLocation} />

        {markerPosition && (
          <Marker position={markerPosition} icon={sunsetArrowIcon}>
            <Popup>
              <strong>Sun position:</strong> {Math.round(sunsetDirection)}°
              {getSunPositionDescription(sunsetDirection)
                ? ` (${getSunPositionDescription(sunsetDirection)})`
                : ""}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {loading && (
        <div className="loading-indicator">Fetching sunset data...</div>
      )}
      {error && <div className="error">{error}</div>}

      {selectedLocation && sunsetData && !loading && (
        <div className="sunset-info">
          <h2>Sunset Information</h2>

          <div className="info-grid">
            <div className="info-item">
              <p>
                <strong>Location</strong> {selectedLocation.lat.toFixed(4)}°,{" "}
                {selectedLocation.lng.toFixed(4)}°
              </p>
            </div>

            <div className="info-item">
              <p>
                <strong>Sunset Time</strong> {formatTime(sunsetData.sunset)}
              </p>
            </div>

            <div className="info-item">
              <p>
                <strong>Sunrise Time</strong> {formatTime(sunsetData.sunrise)}
              </p>
            </div>

            <div className="info-item">
              <p>
                <strong>Day Length</strong>{" "}
                {formatDayLength(sunsetData.day_length)}
              </p>
            </div>

            <div className="info-item">
              <p>
                <strong>Sun Position</strong> {Math.round(sunsetDirection)}°
                {getSunPositionDescription(sunsetDirection)
                  ? ` (${getSunPositionDescription(sunsetDirection)})`
                  : ""}
              </p>
            </div>
          </div>

          {cloudiness !== null && (
            <div className="weather-info">
              <h3>Weather Forecast at Sunset</h3>

              <p>
                <strong>Cloud Coverage</strong> {cloudiness}%
                <span
                  className="cloud-indicator"
                  style={{
                    display: "inline-block",
                    width: `${cloudiness}%`,
                  }}
                ></span>
              </p>

              <p>
                <strong>Visibility Probability</strong> {100 - cloudiness}%
              </p>

              <div className="forecast-suggestion">
                {cloudiness < 30
                  ? "✨ Clear skies expected! Great conditions for viewing the sunset."
                  : cloudiness < 70
                    ? "🌤️ Partially cloudy. You might get a beautiful sunset with cloud colors."
                    : "☁️ Mostly cloudy. The sunset might not be clearly visible."}
              </div>
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
