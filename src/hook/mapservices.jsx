import { useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { OPENROUTESERVICE_API_KEY } from '@env';

export const useMapServices = () => {
  const searchTimeoutRef = useRef(null);
  const userLocationRef = useRef(null);
  const mapScriptLoaded = useRef(false);
  const lastLocationRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isWebMapReady, setIsWebMapReady] = useState(false);

  // --- Validar que la API KEY esté disponible ---
  const validateApiKey = useCallback(() => {
    if (!OPENROUTESERVICE_API_KEY) {
      console.error('❌ OPENROUTESERVICE_API_KEY no está configurada en .env');
      return false;
    }
    return true;
  }, []);

  // --- Inicializar para WEB ---
  const initWebResources = useCallback(() => {
    if (Platform.OS !== "web") return;

    if (!document.getElementById('maplibre-css')) {
      const link = document.createElement("link");
      link.id = 'maplibre-css';
      link.href = "https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    if (!mapScriptLoaded.current) {
      mapScriptLoaded.current = true;

      const script = document.createElement("script");
      script.src = "https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js";
      script.onload = () => {
        setIsWebMapReady(true);
      };
      document.body.appendChild(script);
    }
  }, []);

  // --- Obtener ubicación en WEB ---
  const getWebLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = [position.coords.longitude, position.coords.latitude];
            userLocationRef.current = coords;
            lastLocationRef.current = coords;
            setUserLocation(coords);
            setLoading(false);
            resolve(coords);
          },
          (error) => {
            setLoading(false);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000
          }
        );
      } else {
        setLoading(false);
        reject(new Error("Geolocalización no soportada"));
      }
    });
  }, []);

  // --- Obtener ubicación en MÓVIL ---
  const getMobileLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permiso de ubicación denegado");
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      const coords = [location.coords.longitude, location.coords.latitude];
      userLocationRef.current = coords;
      lastLocationRef.current = coords;
      setUserLocation(coords);
      setLoading(false);
      
      return coords;
    } catch (error) {
      console.error("Error obteniendo ubicación móvil:", error);
      setLoading(false);
      return null;
    }
  }, []);

  // --- Buscar lugares (geocodificación) con debounce ---
  const searchPlaces = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Validar API KEY
    if (!validateApiKey()) {
      console.error("No se puede buscar lugares: API KEY no configurada");
      return;
    }

    try {
      const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${OPENROUTESERVICE_API_KEY}&text=${encodeURIComponent(query)}`;
      console.log("Buscando lugares con API KEY:", OPENROUTESERVICE_API_KEY ? "✅ Configurada" : "❌ No configurada");
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Error en API: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();

      if (data && data.features) {
        setSuggestions(data.features.slice(0, 5));
      }
    } catch (err) {
      console.error("Error buscando lugares:", err);
    }
  }, [validateApiKey]);

  // --- Obtener coordenadas de un lugar ---
  const getCoordinates = useCallback(async (placeName) => {
    // Validar API KEY
    if (!validateApiKey()) {
      console.error("No se puede obtener coordenadas: API KEY no configurada");
      return null;
    }

    try {
      const url = `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTESERVICE_API_KEY}&text=${encodeURIComponent(placeName)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Error en API: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();

      if (data && data.features && data.features.length > 0) {
        return data.features[0].geometry.coordinates;
      }
    } catch (err) {
      console.error("Error obteniendo coordenadas:", err);
    }
    return null;
  }, [validateApiKey]);

  // --- Obtener ruta desde ORS ---
  const fetchRoute = useCallback(async (start, end) => {
    if (!start || !end) {
      console.error("Puntos de ruta no válidos");
      return null;
    }

    // Validar API KEY
    if (!validateApiKey()) {
      console.error("No se puede obtener ruta: API KEY no configurada");
      return null;
    }

    try {
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTESERVICE_API_KEY}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Error en API: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();

      if (data && data.features && data.features.length > 0) {
        const geoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: data.features[0].geometry.coordinates,
              },
              properties: {},
            },
          ],
        };
        return geoJSON;
      } else {
        console.error("No se encontró ruta en la respuesta:", data);
      }
    } catch (err) {
      console.error("Error obteniendo ruta:", err);
    }
    return null;
  }, [validateApiKey]);

  // --- Manejar cambio en el input de búsqueda ---
  const handleDestinationChange = useCallback((text) => {
    setDestination(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(text);
        setShowSuggestions(true);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchPlaces]);

  // --- Manejar selección de destino ---
  const handleSelectDestination = useCallback(async (place) => {
    const placeName = place.properties.label || place.properties.name;
    setDestination(placeName);
    setShowSuggestions(false);
    setSuggestions([]);

    const coords = await getCoordinates(placeName);
    if (coords) {
      setDestinationCoords(coords);
      
      if (userLocationRef.current) {
        const route = await fetchRoute(userLocationRef.current, coords);
        if (route) {
          setRouteGeoJSON(route);
        }
      }
      
      return { coords, placeName };
    }
    return null;
  }, [getCoordinates, fetchRoute]);

  // --- Limpiar destino ---
  const clearDestination = useCallback(() => {
    setDestination("");
    setDestinationCoords(null);
    setRouteGeoJSON(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  // --- Actualizar ubicación en tiempo real (móvil) ---
  const startLocationTracking = useCallback(async (onLocationUpdate, onRouteUpdate) => {
    if (Platform.OS === "web") return;

    try {
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 20
        },
        async (pos) => {
          const newCoords = [pos.coords.longitude, pos.coords.latitude];
          
          // Solo actualizar si la ubicación cambió significativamente
          if (lastLocationRef.current) {
            const [prevLng, prevLat] = lastLocationRef.current;
            const distance = Math.sqrt(
              Math.pow(newCoords[0] - prevLng, 2) + 
              Math.pow(newCoords[1] - prevLat, 2)
            ) * 111000;
            
            if (distance < 20) return;
          }
          
          lastLocationRef.current = newCoords;
          userLocationRef.current = newCoords;
          setUserLocation(newCoords);

          if (onLocationUpdate) {
            onLocationUpdate(newCoords);
          }

          if (destinationCoords && onRouteUpdate) {
            const newRoute = await fetchRoute(newCoords, destinationCoords);
            if (newRoute) {
              setRouteGeoJSON(newRoute);
              onRouteUpdate(newRoute);
            }
          }
        }
      );
    } catch (error) {
      console.error("Error en seguimiento de ubicación:", error);
    }
  }, [destinationCoords, fetchRoute]);

  return {
    // Estado
    userLocation,
    destination,
    destinationCoords,
    routeGeoJSON,
    suggestions,
    showSuggestions,
    loading,
    isWebMapReady,
    userLocationRef,
    
    // Setters
    setRouteGeoJSON,
    setShowSuggestions,
    setUserLocation,
    
    // Funciones
    initWebResources,
    getWebLocation,
    getMobileLocation,
    searchPlaces,
    getCoordinates,
    fetchRoute,
    handleDestinationChange,
    handleSelectDestination,
    clearDestination,
    startLocationTracking,
  };
};