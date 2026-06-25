import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { scaleFont } from '../../constants/responsive';
const CONTROL_HEIGHT = 40;

/**
 * Top bar: Search + Day selector + GPS button
 * UI/UX, styles giữ nguyên như trong MapScreen gốc.
 */
export default function MapTopBar({
  searchQuery,
  onChangeSearch,
  locating,
  onPressLocate,
  selectedDay,
  dayMenuOpen,
  onToggleDayMenu,
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.searchWrapper}>
        <Feather name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm quận, phường, xã..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={onChangeSearch}
        />
      </View>

      {/* Nút chọn ngày */}
      <TouchableOpacity
        style={styles.dayButton}
        onPress={onToggleDayMenu}
      >
        <Text style={styles.dayButtonText}>
          {selectedDay ? `${selectedDay.label} - ${selectedDay.dateStr}` : 'Chọn ngày'}
        </Text>
        <Feather
          name={dayMenuOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#9ca3af"
        />
      </TouchableOpacity>

      {/* Nút GPS */}
      <TouchableOpacity
        style={styles.gpsButton}
        onPress={onPressLocate}
        disabled={locating}
      >
        {locating ? (
          <View style={styles.gpsSpinner} />
        ) : (
          <Feather name="crosshair" size={16} color="#ffffff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: scaleFont(13),
    color: '#111827',
    paddingVertical: 0,
  },
  gpsButton: {
    marginLeft: 0,
    width: CONTROL_HEIGHT,
    height: CONTROL_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  gpsSpinner: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '0deg' }],
  },
  dayButton: {
    marginRight: 8,
    paddingHorizontal: 12,
    height: CONTROL_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: scaleFont(11),
    color: '#111827',
    fontWeight: '600',
    marginRight: 4,
  },
});


