/**
 * Create/edit form aligned with approved Figma design.
 * Hero "Apa yang Anda lihat?" cyan card, 2x2 pastel grid for Rincian
 * (Foto [cyan], Waktu [peach], Lokasi kejadian [peach], Posisi Anda [cyan]),
 * and distinct actions: "Susun dengan AI" (black pill) and "Lanjut tanpa AI →".
 * All autosave, saveState serialization, and navigation guards preserved.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  StatusPill,
  Notice,
  SafetyFooter,
  useTheme,
  space,
  radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor, SaveState } from '../../../src/ui/useReportEditor';
import { services, ModelState } from '../../../src/ui/services';
import { formatTimeWithZone, formatAccuracy, LIMITS } from '../../../src/ui/format';

function saveLabel(s: SaveState): { label: string; kind: 'neutral' | 'busy' | 'positive' | 'error' } {
  switch (s) {
    case 'saving': return { label: 'Menyimpan…', kind: 'busy' };
    case 'saved': return { label: 'Tersimpan', kind: 'positive' };
    case 'failed': return { label: 'Belum tersimpan', kind: 'error' };
    case 'editing': return { label: 'Perubahan belum tersimpan', kind: 'neutral' };
    default: return { label: 'Draf', kind: 'neutral' };
  }
}

export default function EditReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTheme();
  const editor = useReportEditor(id);
  const { report, saveState, errorMessage, isDirty, update, flush } = editor;
  const [models, setModels] = useState<ModelState[]>([]);
  const [navError, setNavError] = useState<string | null>(null);
  const allowLeaveRef = useRef(false);

  useFocusEffect(useCallback(() => {
    void services.listModels().then(setModels).catch(() => {});
    void editor.reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const anyReady = models.some((m) => m.status === 'ready');
  const sl = saveLabel(saveState);

  // Native hardware Back guard
  usePreventRemove(isDirty || saveState === 'saving' || saveState === 'failed', ({ data }) => {
    if (allowLeaveRef.current) return;
    (async () => {
      try {
        await flush();
        allowLeaveRef.current = true;
        navigation.dispatch(data.action);
      } catch (e) {
        setNavError(e instanceof Error ? e.message : 'Belum tersimpan. Ruang perangkat mungkin tidak cukup.');
      }
    })();
  });

  const saveThen = useCallback(async (action: () => void) => {
    setNavError(null);
    try {
      await flush();
      action();
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan. Ruang perangkat mungkin tidak cukup.');
    }
  }, [flush]);

  const goBack = useCallback(() => saveThen(() => { allowLeaveRef.current = true; router.back(); }), [saveThen, router]);
  const goPhotos = useCallback(() => saveThen(() => router.push(`/report/${id}/photos`)), [saveThen, id, router]);
  const goLocation = useCallback(() => saveThen(() => router.push(`/report/${id}/location`)), [saveThen, id, router]);
  const goTime = useCallback(() => saveThen(() => router.push(`/report/${id}/location?focus=time`)), [saveThen, id, router]);
  const runAI = useCallback(() => saveThen(() => router.push(`/report/${id}/generate`)), [saveThen, id, router]);
  const continueManual = useCallback(() => saveThen(() => router.push(`/report/${id}/review`)), [saveThen, id, router]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Buat laporan" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          {errorMessage ? <Notice text={errorMessage} tone="error" /> : <Text style={{ color: t.textSecondary }}>Memuat draf…</Text>}
        </View>
      </Screen>
    );
  }

  const photoCount = report.attachments?.length ?? 0;
  const accuracy = report.observerLocation ? formatAccuracy(report.observerLocation.accuracy) : null;

  return (
    <Screen>
      <FlowHeader
        title="Buat laporan"
        onBack={goBack}
        right={<StatusPill label={sl.label} kind={sl.kind} />}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {saveState === 'failed' ? (
            <Notice text="Belum tersimpan. Ruang perangkat mungkin tidak cukup." tone="error" />
          ) : null}
          {navError ? <Notice text={navError} tone="error" /> : null}
          {!anyReady ? (
            <Notice text="AI belum siap offline. Anda tetap bisa membuat dan menyimpan laporan." />
          ) : null}

          {/* Cyan Hero Card: Apa yang Anda lihat? */}
          <View
            style={[
              {
                backgroundColor: t.cyan,
                borderRadius: 24,
                padding: 18,
                marginBottom: space.lg,
                gap: 8,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ fontSize: 17, fontWeight: '500', color: '#11121A', letterSpacing: 0.1 }}>
              Apa yang Anda lihat?
            </Text>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: '#DFDEE5',
                minHeight: 96,
              }}
            >
              <TextInput
                value={report.rawText}
                onChangeText={(text) => update({ rawText: text.slice(0, LIMITS.maxNotesChars) })}
                placeholder="Asap terlihat dari arah ..."
                placeholderTextColor="#656575"
                multiline
                maxLength={LIMITS.maxNotesChars}
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: '#11121A',
                  textAlignVertical: 'top',
                  minHeight: 70,
                }}
                accessibilityLabel="Catatan pengamatan"
              />
            </View>
            <Text style={{ fontSize: 10, color: '#11121A', textAlign: 'right' }}>
              {report.rawText?.length ?? 0} / {LIMITS.maxNotesChars} karakter
            </Text>
          </View>

          {/* Rincian Section */}
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#11121A', marginBottom: space.sm }}>
            Rincian
          </Text>

          {/* Grid 2x2 */}
          <View style={{ gap: space.md, marginBottom: space.xl }}>
            {/* Row 1: Foto (cyan) & Waktu (peach) */}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              {/* Foto card */}
              <Pressable
                onPress={goPhotos}
                accessibilityRole="button"
                accessibilityLabel={`Foto, ${photoCount} foto ditambahkan`}
                accessibilityHint="Buka kelola foto"
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: t.cyan,
                    borderRadius: 22,
                    padding: 16,
                    height: 154,
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.92 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="camera-outline" size={22} color="#11121A" />
                  </View>
                  <Text style={{ fontSize: 16, color: '#11121A' }}>→</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#11121A', marginBottom: 2 }}>
                    Foto
                  </Text>
                  <Text style={{ fontSize: 12, color: '#465257' }}>
                    {photoCount > 0 ? `${photoCount} foto ditambahkan` : 'Opsional · maks 3'}
                  </Text>
                </View>
              </Pressable>

              {/* Waktu card */}
              <Pressable
                onPress={goTime}
                accessibilityRole="button"
                accessibilityLabel={`Waktu pengamatan, ${formatTimeWithZone(report.observationTime, report.timezone)}`}
                accessibilityHint="Ubah waktu pengamatan"
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: t.peach,
                    borderRadius: 22,
                    padding: 16,
                    height: 154,
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.92 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="time-outline" size={22} color="#11121A" />
                  </View>
                  <Text style={{ fontSize: 16, color: '#11121A' }}>→</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#11121A', marginBottom: 2 }}>
                    Waktu pengamatan
                  </Text>
                  <Text style={{ fontSize: 12, color: '#465257' }} numberOfLines={2}>
                    {formatTimeWithZone(report.observationTime, report.timezone)}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Row 2: Lokasi kejadian (peach) & Posisi Anda (cyan) */}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              {/* Lokasi kejadian card */}
              <Pressable
                onPress={goLocation}
                accessibilityRole="button"
                accessibilityLabel={`Lokasi kejadian, ${report.incidentLocationText?.trim() || 'Patokan atau arah kejadian'}`}
                accessibilityHint="Isi perkiraan lokasi kejadian"
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: t.peach,
                    borderRadius: 22,
                    padding: 16,
                    height: 154,
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.92 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="location-outline" size={22} color="#11121A" />
                  </View>
                  <Text style={{ fontSize: 16, color: '#11121A' }}>→</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#11121A', marginBottom: 2 }}>
                    Lokasi kejadian
                  </Text>
                  <Text style={{ fontSize: 12, color: '#465257' }} numberOfLines={2}>
                    {report.incidentLocationText?.trim() || 'Patokan atau arah kejadian'}
                  </Text>
                </View>
              </Pressable>

              {/* Posisi Anda card */}
              <Pressable
                onPress={goLocation}
                accessibilityRole="button"
                accessibilityLabel={`Posisi Anda, ${report.includeObserverLocation && report.observerLocation ? 'Disertakan' : 'Belum dibagikan'}`}
                accessibilityHint="Isi posisi pelapor"
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: t.cyan,
                    borderRadius: 22,
                    padding: 16,
                    height: 154,
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.92 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="navigate-outline" size={22} color="#11121A" />
                  </View>
                  <Text style={{ fontSize: 16, color: '#11121A' }}>→</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#11121A', marginBottom: 2 }}>
                    Posisi Anda
                  </Text>
                  <Text style={{ fontSize: 12, color: '#465257' }}>
                    {report.includeObserverLocation && report.observerLocation
                      ? `Terisi${accuracy ? ` · ${accuracy}` : ''}`
                      : 'Belum dibagikan'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Action: Susun dengan AI (black pill) */}
          <Pressable
            onPress={runAI}
            accessibilityRole="button"
            accessibilityLabel="Susun dengan AI"
            accessibilityHint="Menyimpan draf lalu menjalankan AI lokal"
            style={({ pressed }) => [
              {
                backgroundColor: '#11121A',
                height: 50,
                borderRadius: 25,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.88 : 1,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
              Susun dengan AI
            </Text>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </Pressable>

          {/* Action: Lanjut tanpa AI */}
          <Pressable
            onPress={continueManual}
            accessibilityRole="button"
            accessibilityLabel="Lanjut tanpa AI"
            accessibilityHint="Melanjutkan ke tinjau tanpa AI"
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              marginTop: 4,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#656575', fontSize: 13, fontWeight: '600' }}>
              Lanjut tanpa AI →
            </Text>
          </Pressable>

          <SafetyFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
