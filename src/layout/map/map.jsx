import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Platform, 
  StyleSheet, 
  ActivityIndicator,
  Text // ¡IMPORTANTE! Agregar Text
} from 'react-native';
import MapComponent from '../../components/mapcomponent';
import SearchComponent from '../../components/searchcomponent';
import { useMapServices } from '../../hook/mapservices';

const MapLayout = () => {
  const webviewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [clearDestinationCount, setClearDestinationCount] = useState(0);
  
  const {
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
    fetchRoute,
    handleDestinationChange,
    handleSelectDestination,
    clearDestination,
    startLocationTracking,
  } = useMapServices();

  // --- Inicialización según plataforma ---
  useEffect(() => {
    const initialize = async () => {
      if (Platform.OS === "web") {
        initWebResources();
        try {
          await getWebLocation();
        } catch (error) {
          console.error("Error obteniendo ubicación web:", error);
        }
      } else {
        await getMobileLocation();
      }
    };

    initialize();
  }, [initWebResources, getWebLocation, getMobileLocation]);

  // --- Inicializar tracking de ubicación en móvil ---
  useEffect(() => {
    if (Platform.OS !== "web" && userLocation) {
      startLocationTracking(
        (newCoords) => {
          setUserLocation(newCoords);
        },
        (newRoute) => {
          setRouteGeoJSON(newRoute);
        }
      );
    }
  }, [userLocation, startLocationTracking, setUserLocation, setRouteGeoJSON]);

  // --- Manejar selección de destino ---
  const handleDestinationSelect = async (place) => {
    const result = await handleSelectDestination(place);
    if (!result || !userLocation) {
      return;
    }

    const { coords } = result;
    
    // Calcular ruta
    const route = await fetchRoute(userLocation, coords);
    setRouteGeoJSON(route);

    // Actualizar mapa según plataforma
    if (Platform.OS === "web" && isWebMapReady) {
      updateWebMapDestination(coords, route);
    } else if (Platform.OS !== "web" && webviewRef.current && isWebViewReady) {
      updateMobileMapDestination(coords, route);
    }
  };

  // --- SVG del pin estilo Google Maps ---
  const getPinSVG = () => {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="24" height="34">
        <path fill="#EA4335" d="M12 0C5.4 0 0 5.4 0 12c0 8.1 12 22 12 22s12-13.9 12-22c0-6.6-5.4-12-12-12z"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
    `;
  };

  // --- Actualizar destino en mapa web ---
  const updateWebMapDestination = (coords, route) => {
    try {
      // Asegurarse de que MapLibre esté cargado
      if (!window.maplibregl) {
        return;
      }

      const map = window.map;
      if (!map) {
        return;
      }

      // Remover marcador de destino anterior si existe
      if (window.destinationMarker) {
        window.destinationMarker.remove();
        window.destinationMarker = null;
      }

      // Crear elemento para el marcador de destino (PIN estilo Google Maps)
      const destinationElement = document.createElement('div');
      destinationElement.innerHTML = getPinSVG();

      // Agregar nuevo marcador de destino
      window.destinationMarker = new window.maplibregl.Marker({
        element: destinationElement,
        anchor: 'bottom'
      })
        .setLngLat(coords)
        .addTo(map);

      // Actualizar ruta
      const source = map.getSource("ruta");
      if (source && route) {
        source.setData(route);
      }

      // Centrar mapa en la ruta
      if (userLocation && coords) {
        const bounds = new window.maplibregl.LngLatBounds();
        bounds.extend(userLocation);
        bounds.extend(coords);
        map.fitBounds(bounds, { padding: 50, duration: 1000 });
      }

    } catch (error) {
      console.error("Error actualizando destino web:", error);
    }
  };

  // --- Actualizar destino en mapa móvil ---
  const updateMobileMapDestination = (coords, route) => {
    if (!webviewRef.current || !isWebViewReady) {
      return;
    }

    const jsCode = `
      try {
        // Remover marcador de destino anterior si existe
        if (window.destinationMarker) {
          window.destinationMarker.remove();
        }
        
        // Agregar nuevo marcador de destino (PIN estilo Google Maps)
        const destinationElement = document.createElement('div');
        destinationElement.className = 'destination-pin';
        
        window.destinationMarker = new maplibregl.Marker({
          element: destinationElement,
          anchor: 'bottom'
        })
          .setLngLat([${coords[0]}, ${coords[1]}])
          .addTo(window.map);
        
        // Actualizar ruta
        if (window.map && window.map.getSource('ruta')) {
          window.map.getSource('ruta').setData(${JSON.stringify(route)});
        }
        
        // Centrar mapa en la ruta
        if (window.map) {
          const bounds = new maplibregl.LngLatBounds();
          bounds.extend([${userLocation[0]}, ${userLocation[1]}]);
          bounds.extend([${coords[0]}, ${coords[1]}]);
          window.map.fitBounds(bounds, { padding: 50, duration: 1000 });
        }
        
      } catch (error) {
        console.error('Error actualizando destino en móvil:', error);
      }
    `;

    webviewRef.current.injectJavaScript(jsCode);
  };

  // --- Limpiar destino completo ---
  const handleClearDestination = () => {
    clearDestination();
    setClearDestinationCount(prev => prev + 1);
    
    if (Platform.OS === "web" && window.maplibregl) {
      try {
        if (window.destinationMarker) {
          window.destinationMarker.remove();
          window.destinationMarker = null;
        }
        if (window.map && window.map.getSource("ruta")) {
          window.map.getSource("ruta").setData({ 
            type: "FeatureCollection", 
            features: [] 
          });
        }
      } catch (error) {
        console.error("Error limpiando destino web:", error);
      }
    }
  };

  // --- Manejar mensajes de WebView ---
  const onWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    
    if (message === 'WEBVIEW_READY') {
      setIsWebViewReady(true);
      
      // Si ya tenemos ubicación, inicializar el mapa con ella
      if (userLocation && webviewRef.current) {
        const jsCode = `
          try {
            if (window.initializeWithLocation) {
              window.initializeWithLocation(${userLocation[0]}, ${userLocation[1]});
            }
          } catch (error) {
            console.error('Error inicializando ubicación:', error);
          }
        `;
        
        setTimeout(() => {
          webviewRef.current?.injectJavaScript(jsCode);
        }, 500);
      }
    }
  };

  // --- Efecto para actualizar ubicación en WebView cuando cambia ---
  useEffect(() => {
    if (Platform.OS !== "web" && webviewRef.current && isWebViewReady && userLocation) {
      const jsCode = `
        try {
          if (window.updateUserLocation) {
            window.updateUserLocation(${userLocation[0]}, ${userLocation[1]});
          }
        } catch (error) {
          console.error('Error actualizando ubicación:', error);
        }
      `;
      
      webviewRef.current.injectJavaScript(jsCode);
    }
  }, [userLocation, isWebViewReady]);

  // --- Loader ---
  if (loading) {
    if (Platform.OS === "web") {
      return (
        <div style={styles.webLoader}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: 20, color: '#666' }}>Cargando mapa...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    } else {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="blue" />
          <Text style={{ marginTop: 10, color: '#666' }}>Obteniendo ubicación...</Text>
        </View>
      );
    }
  }

  // --- Si no hay ubicación, mostrar loader ---
  if (!userLocation) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="blue" />
        <Text style={{ marginTop: 10, color: '#666' }}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, position: 'relative', backgroundColor: '#f5f5f5' }}>
      {/* Componente del Mapa */}
      <MapComponent
        webviewRef={webviewRef}
        isWebViewReady={isWebViewReady}
        userLocation={userLocation}
        destinationCoords={destinationCoords}
        routeGeoJSON={routeGeoJSON}
        clearDestinationTrigger={clearDestinationCount}
        onWebViewMessage={onWebViewMessage}
      />
      
      {/* Componente de Búsqueda */}
      <SearchComponent
        destination={destination}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        handleDestinationChange={handleDestinationChange}
        handleSelectDestination={handleDestinationSelect}
        clearDestination={handleClearDestination}
      />
    </View>
  );
};

// Estilos
const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  webLoader: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f5f5f5'
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 2s linear infinite',
  },
});

export default MapLayout;