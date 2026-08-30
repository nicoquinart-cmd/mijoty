import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/lib/theme';

export function AppModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.head}><Text style={s.title}>{title}</Text><Pressable onPress={onClose}><Text style={s.close}>✕</Text></Pressable></View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'; multiline?: boolean }) {
  return <View style={{ marginBottom: 12 }}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 4 : 1} textAlignVertical={multiline ? 'top' : 'center'} style={[s.input, multiline && { minHeight: 96 }]} /></View>;
}

export function ModalButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: .5 }]}><Text style={[s.buttonText, secondary && { color: colors.brown }]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(52,45,42,.35)', justifyContent: 'center', padding: 18 },
  sheet: { backgroundColor: colors.cream, borderRadius: 24, padding: 18, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '900', color: colors.brown },
  close: { fontSize: 20, color: colors.muted, padding: 6 },
  label: { color: colors.brown, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 13, color: colors.brown, fontSize: 16 },
  button: { backgroundColor: colors.terracotta, paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
