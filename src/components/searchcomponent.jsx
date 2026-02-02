import React from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  KeyboardAvoidingView,
  Platform,
  StyleSheet 
} from "react-native";
import { Feather } from '@expo/vector-icons';

const SearchComponent = ({
  // Props
  destination,
  suggestions,
  showSuggestions,
  
  // Handlers
  handleDestinationChange,
  handleSelectDestination,
  clearDestination,
  
  // Estilos personalizados
  containerStyle,
  inputStyle
}) => {
  
  // --- Handler para seleccionar sugerencia ---
  const handleSuggestionClick = (place) => {
    console.log("Sugerencia seleccionada:", place);
    handleSelectDestination(place);
  };

  // --- Handler para limpiar búsqueda ---
  const handleClearClick = () => {
    console.log("Limpiando búsqueda");
    clearDestination();
  };

  // --- Handler para cambio en input ---
  const handleInputChange = (text) => {
    console.log("Cambio en input:", text);
    handleDestinationChange(text);
  };

  // --- Render web ---
  if (Platform.OS === "web") {
    return (
      <div style={styles.searchBox}>
        <div style={{
          ...styles.searchInputContainer,
          ...(showSuggestions ? styles.searchInputContainerFocused : {})
        }}>
          <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="¿A dónde quieres ir?"
            value={destination}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {}}
            onBlur={() => {}}
            style={styles.searchInput}
          />
          {destination && (
            <button
              onClick={handleClearClick}
              style={styles.clearButton}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '20px', color: '#666', lineHeight: '1' }}>×</span>
            </button>
          )}
        </div>

        {/* Mostrar sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={styles.suggestionsContainer}>
            {suggestions.map((place, index) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(place)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                style={{
                  ...styles.suggestionItem,
                  ...(index === suggestions.length - 1 ? styles.suggestionItemLast : {})
                }}
              >
                <Feather name="map-pin" size={16} color="#666" style={{ marginRight: 12, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#333', lineHeight: '1.2' }}>
                    {place.properties.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', lineHeight: '1.2' }}>
                    {place.properties.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Render móvil ---
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.mobileSearchContainer, containerStyle]}
    >
      <View style={[styles.mobileSearchBox, inputStyle]}>
        <Feather name="search" size={20} color="#666" style={styles.mobileSearchIcon} />
        <TextInput
          placeholder="¿A dónde quieres ir?"
          value={destination}
          onChangeText={handleInputChange}
          style={styles.mobileSearchInput}
          placeholderTextColor="#666"
        />
        {destination && (
          <TouchableOpacity
            onPress={handleClearClick}
            style={styles.mobileClearButton}
          >
            <Text style={styles.mobileClearButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mostrar sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.mobileSuggestionsContainer}>
          {suggestions.map((place, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSuggestionClick(place)}
              style={styles.mobileSuggestionItem}
            >
              <Feather name="map-pin" size={16} color="#666" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: '#000' }}>{place.properties.name}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>{place.properties.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// Estilos
const styles = StyleSheet.create({
  // Estilos React Native
  mobileSearchContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  mobileSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  mobileSearchIcon: {
    marginRight: 10,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    color: '#000',
  },
  mobileClearButton: {
    paddingHorizontal: 8,
  },
  mobileClearButtonText: {
    fontSize: 24,
    color: '#666',
  },
  mobileSuggestionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 200,
  },
  mobileSuggestionItem: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  
  // Estilos para Web
  searchBox: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '500px',
    maxWidth: '90%',
    zIndex: 1000,
  },
  searchInputContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: '28px',
    padding: '8px 16px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    border: '1px solid #e0e0e0',
    transition: 'all 0.3s ease',
  },
  searchInputContainerFocused: {
    boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
    borderColor: '#4285F4',
  },
  searchIcon: {
    marginRight: '10px',
    color: '#666',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    padding: '8px 0',
    width: '100%',
    backgroundColor: 'transparent',
    color: '#333',
  },
  clearButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 4px 0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    marginTop: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    maxHeight: '320px',
    overflowY: 'auto',
    border: '1px solid #e0e0e0',
  },
  suggestionItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background-color 0.2s',
    minHeight: '56px',
  },
  suggestionItemLast: {
    borderBottom: 'none',
  },
});

export default SearchComponent;