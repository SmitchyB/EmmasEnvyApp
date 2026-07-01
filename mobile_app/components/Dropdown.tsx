import React, { useState } from 'react'; // Import the React and useState from react for the state
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'; // Import the Modal, Pressable, ScrollView, StyleSheet, Text, and View from react-native for the components
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors from @/constants/theme for the colors

type DropdownProps = { // Defines the dropdown props type
  options: string[]; // Defines the options type
  value: string; // Defines the value type
  onSelect: (value: string) => void; // Defines the on select function type
  placeholder?: string; // Defines the placeholder type
  style?: object; // Defines the style type
  disabled?: boolean; // Defines the disabled type
};
// Defines the dropdown component
export function Dropdown({ options, value, onSelect, placeholder = 'Select…', style, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false); // Get the open from the useState

  const displayValue = value || placeholder; // Get the display value from the value or placeholder
  const isPlaceholder = !value; // Get the is placeholder from the value

  // Defines the handle select function
  const handleSelect = (option: string) => {
    onSelect(option); // On select the option
    setOpen(false); // Set the open to false
  };

  // Return the dropdown component with the options, value, on select, placeholder, style, and disabled
  return (
    <>
      <Pressable
        style={[styles.trigger, isPlaceholder && styles.triggerPlaceholder, style, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}>
        <Text style={[styles.triggerText, isPlaceholder && styles.triggerTextPlaceholder]} numberOfLines={1}>
          {displayValue}
        </Text>
        <Text style={styles.triggerChevron}>▼</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={styles.emptyText}>No options</Text>
              ) : (
                options.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.option, opt === value && styles.optionSelected]}
                    onPress={() => handleSelect(opt)}>
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.cancelButton} onPress={() => setOpen(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// Defines the styles for the dropdown component
const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    minHeight: 48,
  },
  triggerPlaceholder: {},
  triggerDisabled: { opacity: 0.6 },
  triggerText: { fontSize: 16, color: NavbarColors.text, flex: 1 },
  triggerTextPlaceholder: { color: NavbarColors.textMuted },
  triggerChevron: { fontSize: 10, color: NavbarColors.textMuted, marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'rgba(40,20,30,0.98)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    maxHeight: '70%',
  },
  scroll: { maxHeight: 320 },
  emptyText: { padding: 16, color: NavbarColors.textMuted, fontSize: 16 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  optionSelected: { backgroundColor: 'rgba(255,100,120,0.2)' },
  optionText: { fontSize: 16, color: NavbarColors.text },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', borderTopWidth: 1, borderTopColor: NavbarColors.border },
  cancelButtonText: { color: NavbarColors.textMuted, fontSize: 16 },
});
