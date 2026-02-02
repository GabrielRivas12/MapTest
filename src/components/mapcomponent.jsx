import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  ActivityIndicator, 
  Platform, 
  StyleSheet 
} from "react-native";
import { WebView } from "react-native-webview";

const MapComponent = ({
  webviewRef,
  isWebViewReady,
  userLocation,
  onWebViewMessage,
  destinationCoords,
  routeGeoJSON,
}) => {
  const mapRef = useRef(null);
  const mapInitialized = useRef(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const hasInitialized = useRef(false);
  const lastUserLocationRef = useRef(null);

  // --- HTML estático para móvil ---
  const mobileHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet"/>
    <style>
      body, html { 
        margin:0; 
        padding:0; 
        height:100%; 
        width:100%; 
        overflow: hidden;
      } 
      #map { 
        width:100%; 
        height:100%; 
      }
      .user-location-circle {
        width: 24px;
        height: 24px;
        background-color: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        position: relative;
      }
      .user-location-circle::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        background-color: white;
        border-radius: 50%;
      }
      .destination-pin {
        width: 24px;
        height: 34px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34"><path fill="%23EA4335" d="M12 0C5.4 0 0 5.4 0 12c0 8.1 12 22 12 22s12-13.9 12-22c0-6.6-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>');
        background-size: contain;
        background-repeat: no-repeat;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
    <script>
      let map = null;
      let userLocationMarker = null;
      let destinationMarker = null;
      let isMapReady = false;
      let lastUserCoords = null;
      
      function initializeMap() {
        try {
          const defaultCoords = [0, 0];
          
          map = new maplibregl.Map({
            container: 'map',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: defaultCoords,
            zoom: 2,
            attributionControl: false
          });

          map.on('load', function() {
            // Crear elemento para el círculo de ubicación
            const userLocationElement = document.createElement('div');
            userLocationElement.className = 'user-location-circle';
            
            // Marcador de usuario
            userLocationMarker = new maplibregl.Marker({
              element: userLocationElement,
              anchor: 'center'
            })
              .setLngLat(defaultCoords)
              .addTo(map);

            // Inicializar fuente de ruta vacía
            map.addSource('ruta', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: []
              }
            });
            
            map.addLayer({
              id: 'ruta-line',
              type: 'line',
              source: 'ruta',
              paint: {
                'line-color': '#1a73e8',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });

            window.map = map;
            isMapReady = true;
            
            // Notificar que está lista
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('WEBVIEW_READY');
            }
          });

        } catch (error) {
          console.error('Error inicializando mapa:', error);
        }
      }

      // Inicializar el mapa cuando se carga la página
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMap);
      } else {
        initializeMap();
      }

      // Función para inicializar con ubicación real
      window.initializeWithLocation = function(lng, lat) {
        if (!isMapReady) {
          setTimeout(() => window.initializeWithLocation(lng, lat), 100);
          return;
        }
        
        try {
          lastUserCoords = [lng, lat];
          if (userLocationMarker && map) {
            userLocationMarker.setLngLat([lng, lat]);
            map.setCenter([lng, lat]);
            map.setZoom(14);
          }
        } catch (error) {
          console.error('Error en initializeWithLocation:', error);
        }
      };

      // Actualizar ubicación solo si cambió significativamente
      window.updateUserLocation = function(lng, lat) {
        if (!isMapReady) return;
        
        try {
          // Solo actualizar si la ubicación cambió significativamente (> 10 metros)
          const newCoords = [lng, lat];
          if (lastUserCoords) {
            const distance = Math.sqrt(
              Math.pow(newCoords[0] - lastUserCoords[0], 2) + 
              Math.pow(newCoords[1] - lastUserCoords[1], 2)
            ) * 111000; // Convertir grados a metros aprox
            
            if (distance < 10) return; // No actualizar si el cambio es menor a 10 metros
          }
          
          lastUserCoords = newCoords;
          if (userLocationMarker) {
            userLocationMarker.setLngLat(newCoords);
          }
        } catch (error) {
          console.error('Error en updateUserLocation:', error);
        }
      };

      window.updateRoute = function(route) {
        try {
          if (map && map.getSource('ruta')) {
            map.getSource('ruta').setData(route);
            
            if (route.features && route.features.length > 0) {
              const coordinates = route.features[0].geometry.coordinates;
              if (coordinates.length > 0) {
                const bounds = coordinates.reduce((bounds, coord) => {
                  return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
                
                map.fitBounds(bounds, {
                  padding: 50,
                  duration: 1000
                });
              }
            }
          }
        } catch (error) {
          console.error('Error en updateRoute:', error);
        }
      };
      
      window.updateDestination = function(lng, lat) {
        try {
          if (destinationMarker) {
            destinationMarker.remove();
          }
          
          const destinationElement = document.createElement('div');
          destinationElement.className = 'destination-pin';
          
          destinationMarker = new maplibregl.Marker({
            element: destinationElement,
            anchor: 'bottom'
          })
            .setLngLat([lng, lat])
            .addTo(map);
        } catch (error) {
          console.error('Error en updateDestination:', error);
        }
      };
      
      window.clearDestination = function() {
        try {
          if (destinationMarker) {
            destinationMarker.remove();
            destinationMarker = null;
          }
          if (map && map.getSource('ruta')) {
            map.getSource('ruta').setData({
              type: 'FeatureCollection',
              features: []
            });
          }
        } catch (error) {
          console.error('Error en clearDestination:', error);
        }
      };
    </script>
  </body>
  </html>
  `;

  // --- Inicializar mapa web ---
  const initWebMap = () => {
    if (Platform.OS !== "web" || !window.maplibregl || !userLocation || mapInitialized.current) {
      return;
    }

    mapInitialized.current = true;

    try {
      const map = new window.maplibregl.Map({
        container: "map",
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: userLocation,
        zoom: 14,
      });

      mapRef.current = map;

      map.on('load', () => {
        const userLocationElement = document.createElement('div');
        userLocationElement.className = 'user-location-marker-web';
        userLocationElement.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background-color: #4285F4;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            position: relative;
          ">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 10px;
              height: 10px;
              background-color: white;
              border-radius: 50%;
            "></div>
          </div>
        `;

        window.userLocationMarker = new window.maplibregl.Marker({
          element: userLocationElement,
          anchor: 'center'
        })
          .setLngLat(userLocation)
          .addTo(map);

        map.addSource("ruta", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] }
        });

        map.addLayer({
          id: "ruta-line",
          type: "line",
          source: "ruta",
          paint: {
            "line-color": "#1a73e8",
            "line-width": 4,
            "line-opacity": 0.8
          },
        });

        window.map = map;
        
        if (destinationCoords) {
          updateWebDestination(destinationCoords);
        }
        if (routeGeoJSON) {
          updateWebRoute(routeGeoJSON);
        }
      });

    } catch (error) {
      mapInitialized.current = false;
    }
  };

  // --- Función para actualizar destino en mapa web ---
  const updateWebDestination = (coords) => {
    if (Platform.OS !== "web" || !mapRef.current || !window.maplibregl) return;

    try {
      if (window.destinationMarker) {
        window.destinationMarker.remove();
        window.destinationMarker = null;
      }
      
      const destinationElement = document.createElement('div');
      destinationElement.className = 'destination-pin-web';
      destinationElement.innerHTML = `
        <div style="
          width: 24px;
          height: 34px;
          background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34"><path fill="%23EA4335" d="M12 0C5.4 0 0 5.4 0 12c0 8.1 12 22 12 22s12-13.9 12-22c0-6.6-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>');
          background-size: contain;
          background-repeat: no-repeat;
        "></div>
      `;
      
      window.destinationMarker = new window.maplibregl.Marker({
        element: destinationElement,
        anchor: 'bottom'
      })
        .setLngLat(coords)
        .addTo(mapRef.current);

    } catch (error) {}
  };

  // --- Función para actualizar ruta en mapa web ---
  const updateWebRoute = (route) => {
    if (Platform.OS !== "web" || !mapRef.current) return;

    try {
      const source = mapRef.current.getSource("ruta");
      if (source) {
        source.setData(route);
        
        if (route.features && route.features.length > 0) {
          const coordinates = route.features[0].geometry.coordinates;
          if (coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new window.maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
            
            mapRef.current.fitBounds(bounds, {
              padding: 50,
              duration: 1000
            });
          }
        }
      }
    } catch (error) {}
  };

  // --- Efecto para inicializar mapa web ---
  useEffect(() => {
    if (Platform.OS === "web") {
      const checkMapLibre = () => {
        if (window.maplibregl && userLocation && !mapInitialized.current) {
          initWebMap();
        } else if (!window.maplibregl) {
          setTimeout(checkMapLibre, 500);
        }
      };

      checkMapLibre();
    }
  }, [userLocation]);

  // --- Efecto para actualizar destino en web ---
  useEffect(() => {
    if (Platform.OS === "web" && destinationCoords && mapRef.current && mapInitialized.current) {
      updateWebDestination(destinationCoords);
    }
  }, [destinationCoords]);

  // --- Efecto para actualizar ruta en web ---
  useEffect(() => {
    if (Platform.OS === "web" && routeGeoJSON && mapRef.current && mapInitialized.current) {
      updateWebRoute(routeGeoJSON);
    }
  }, [routeGeoJSON]);

  // --- Inicializar WebView solo una vez cuando tenemos userLocation ---
  useEffect(() => {
    if (Platform.OS !== "web" && userLocation && !hasInitialized.current) {
      hasInitialized.current = true;
      setWebViewKey(prev => prev + 1);
    }
  }, [userLocation]);

  // --- Actualizar ubicación en WebView cuando cambia significativamente ---
  useEffect(() => {
    if (Platform.OS !== "web" && webviewRef.current && isWebViewReady && userLocation) {
      // Solo actualizar si la ubicación cambió significativamente (> 10 metros)
      if (lastUserLocationRef.current) {
        const [prevLng, prevLat] = lastUserLocationRef.current;
        const [currLng, currLat] = userLocation;
        const distance = Math.sqrt(
          Math.pow(currLng - prevLng, 2) + 
          Math.pow(currLat - prevLat, 2)
        ) * 111000; // Convertir grados a metros aprox
        
        if (distance < 10) return; // No actualizar si el cambio es menor a 10 metros
      }
      
      lastUserLocationRef.current = userLocation;
      
      const jsCode = `
        try {
          if (window.updateUserLocation) {
            window.updateUserLocation(${userLocation[0]}, ${userLocation[1]});
          }
        } catch (error) {}
      `;
      
      webviewRef.current.injectJavaScript(jsCode);
    }
  }, [userLocation, isWebViewReady]);

  // --- Actualizar destino y ruta en WebView (móvil) ---
  useEffect(() => {
    if (Platform.OS !== "web" && webviewRef.current && isWebViewReady) {
      if (destinationCoords) {
        const updateDestCode = `
          try {
            if (window.updateDestination) {
              window.updateDestination(${destinationCoords[0]}, ${destinationCoords[1]});
            }
          } catch (error) {}
        `;
        webviewRef.current.injectJavaScript(updateDestCode);
      }

      if (routeGeoJSON) {
        const updateRouteCode = `
          try {
            if (window.updateRoute) {
              window.updateRoute(${JSON.stringify(routeGeoJSON)});
            }
          } catch (error) {}
        `;
        webviewRef.current.injectJavaScript(updateRouteCode);
      }
    }
  }, [destinationCoords, routeGeoJSON, isWebViewReady]);

  // --- Render web ---
  if (Platform.OS === "web") {
    useEffect(() => {
      if (Platform.OS === "web" && !document.getElementById('maplibre-css')) {
        const link = document.createElement("link");
        link.id = 'maplibre-css';
        link.href = "https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
    }, []);

    return (
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <div id="map" style={{ width: "100%", height: "100%" }}></div>
        {!mapInitialized.current && userLocation && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px'
            }}></div>
            <p style={{ margin: 0, color: '#666', textAlign: 'center' }}>
              Cargando mapa...
            </p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        key={`webview-${webViewKey}`}
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: mobileHTML }}
        style={{ flex: 1 }}
        onMessage={onWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="blue" />
          </View>
        )}
        onLoadEnd={() => {
          if (userLocation && webviewRef.current) {
            const jsCode = `
              try {
                if (window.initializeWithLocation) {
                  window.initializeWithLocation(${userLocation[0]}, ${userLocation[1]});
                }
              } catch (error) {}
            `;
            
            setTimeout(() => {
              webviewRef.current?.injectJavaScript(jsCode);
            }, 500);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'white'
  }
});

export default MapComponent;