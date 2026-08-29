import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setMessage('');
    if (!email.trim() || !password) {
      setMessage('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: firstName.trim() || 'Utilisateur' } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Compte créé. Vérifiez votre e-mail pour confirmer votre inscription, puis connectez-vous.');
        }
      }
    } catch (e: any) {
      setMessage(e?.message || 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <Text style={s.brand}>Mijoty</Text>
        <Text style={s.tagline}>Mieux manger. Mieux dépenser.</Text>
        <View style={s.card}>
          <Text style={s.title}>{mode === 'login' ? 'Connexion' : 'Créer mon compte'}</Text>
          {mode === 'signup' && (
            <TextInput value={firstName} onChangeText={setFirstName} placeholder="Prénom" style={s.input} />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            style={s.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            secureTextEntry
            style={s.input}
          />
          {!!message && <Text style={s.message}>{message}</Text>}
          <Pressable style={s.button} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{mode === 'login' ? 'Me connecter' : 'Créer mon compte'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>
            <Text style={s.link}>{mode === 'login' ? 'Créer un compte Mijoty' : 'J’ai déjà un compte'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  wrap: { flex: 1, justifyContent: 'center', padding: 22, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 44, fontWeight: '900', color: colors.terracotta, textAlign: 'center' },
  tagline: { textAlign: 'center', color: colors.muted, fontSize: 16, marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 20 },
  title: { fontSize: 24, fontWeight: '900', color: colors.brown, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, fontSize: 16, color: colors.brown },
  message: { color: colors.red, marginVertical: 6, lineHeight: 20 },
  button: { backgroundColor: colors.terracotta, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  link: { color: colors.terracotta, textAlign: 'center', fontWeight: '800', marginTop: 16 },
});
