/**
 * Location screen aligned with approved Figma design.
 * Clear separation:
 * 1. Lokasi kejadian (Cyan card): manual description/landmark, never inferring event from observer GPS.
 * 2. Posisi Anda (Cyan card): optional observer GPS with accuracy notice.
 * 3. Yang akan dibagikan (White card): toggle "Sertakan posisi tepat saya".
 * 4. Waktu pengamatan (Peach card): observation time and timezone.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Notice,
  useTheme,
  space,
  radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor } from '../../../src/ui/useReportEditor';
import { services } from '../../../src/ui/services';
import { formatAccuracy, formatTimeWithZone } from '../../../src/ui/format';

export default function LocationScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTheme();
  const { report, update, flush, isDirty, saveState } = useReportEditor(id);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(focus === 'time');
  const allowLeaveRef = useRef(false);

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

  const goBack = useCallback(async () => {
    setNavError(null);
    try {
      await flush();
      allowLeaveRef.current = true;
      router.back();
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan. Ruang perangkat mungkin tidak cukup.');
    }
  }, [flush, router]);

  const useGps = useCallback(async () => {
    setGpsBusy(true);
    setGpsError(null);
    try {
      const pos = await services.getObserverLocation();
      update({ observerLocation: pos, includeObserverLocation: true });
    } catch {
      setGpsError('Lokasi tidak tersedia. Anda bisa menulis patokan secara manual.');
    } finally {
      setGpsBusy(false);
    }
  }, [update]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Lokasi laporan" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          <Text style={{ color: t.textSecondary }}>Memuat…</Text>
        </View>
      </Screen>
    );
  }

  const accuracy = report.observerLocation ? formatAccuracy(report.observerLocation.accuracy) : null;

  return (
    <Screen>
      <FlowHeader
        title="Lokasi laporan"
        onBack={goBack}
        helpActionLabel="Kanal bantuan"
        onHelp={() => router.push('/channels')}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {navError ? <Notice text={navError} tone="error" /> : null}

          {/* CARD 1: LOKASI KEJADIAN (CYAN) */}
          <View
            style={[
              {
                backgroundColor: t.cyan,
                borderRadius: 24,
                padding: 18,
                marginBottom: space.lg,
                gap: 10,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location-outline" size={22} color="#11121A" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Lokasi kejadian
              </Text>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#465257' }}>
              Patokan atau arah
            </Text>

            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: '#DFDEE5',
                minHeight: 92,
              }}
            >
              <TextInput
                value={report.incidentLocationText}
                onChangeText={(text) => update({ incidentLocationText: text })}
                placeholder="Misal: Kebun di seberang jalan, arah utara dari pos ronda..."
                placeholderTextColor="#656575"
                multiline
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: '#11121A',
                  textAlignVertical: 'top',
                  minHeight: 65,
                }}
                accessibilityLabel="Patokan atau perkiraan arah lokasi kejadian"
              />
            </View>

            <Text style={{ fontSize: 11, color: '#465257' }}>
              Tulis yang diketahui; perkiraan boleh. Lokasi kejadian tidak pernah diambil otomatis dari GPS pelapor.
            </Text>
          </View>

          {/* CARD 2: POSISI ANDA · OPSIONAL (CYAN) */}
          <View
            style={[
              {
                backgroundColor: t.cyan,
                borderRadius: 24,
                padding: 18,
                marginBottom: space.lg,
                gap: 10,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="navigate-outline" size={22} color="#11121A" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Posisi Anda · opsional
              </Text>
            </View>

            {gpsError ? <Notice text={gpsError} tone="warn" /> : null}

            {report.observerLocation ? (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 14,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#11121A' }}>
                  Lat {report.observerLocation.latitude.toFixed(5)}, Lon {report.observerLocation.longitude.toFixed(5)}
                </Text>
                <Text style={{ fontSize: 11, color: '#656575' }}>
                  {accuracy ? `Akurasi ${accuracy}` : 'Akurasi tidak diketahui'} · {formatTimeWithZone(report.observerLocation.timestamp, undefined)}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#465257' }}>
                Posisi Anda belum diisi.
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={useGps}
                disabled={gpsBusy}
                accessibilityRole="button"
                accessibilityLabel="Gunakan posisi saya dari GPS"
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: '#11121A',
                    borderRadius: 18,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.88 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {gpsBusy ? 'Mencari GPS…' : 'Gunakan posisi saya'}
                </Text>
              </Pressable>

              {report.observerLocation ? (
                <Pressable
                  onPress={() => update({ includeObserverLocation: false, observerLocation: null })}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus posisi pelapor"
                  style={{
                    backgroundColor: '#FEE2E2',
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '600' }}>
                    Hapus
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* CARD 3: YANG AKAN DIBAGIKAN (WHITE) */}
          <View
            style={[
              {
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 18,
                marginBottom: space.lg,
                gap: 10,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="lock-closed-outline" size={20} color="#11121A" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Yang akan dibagikan
              </Text>
            </View>

            <Pressable
              onPress={() => update({ includeObserverLocation: !report.includeObserverLocation })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: report.includeObserverLocation }}
              accessibilityLabel="Sertakan posisi tepat saya"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
            >
              <Ionicons
                name={report.includeObserverLocation ? 'checkbox' : 'square-outline'}
                size={22}
                color={report.includeObserverLocation ? '#11121A' : '#656575'}
              />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#11121A' }}>
                Sertakan posisi tepat saya
              </Text>
            </Pressable>

            <Text style={{ fontSize: 12, color: '#656575' }}>
              Anda tetap bisa melapor tanpa menyertakan posisi GPS.
            </Text>
          </View>

          {/* CARD 4: WAKTU PENGAMATAN (PEACH) */}
          <View
            style={[
              {
                backgroundColor: t.peach,
                borderRadius: 24,
                padding: 18,
                marginBottom: space.xl,
                gap: 10,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time-outline" size={22} color="#11121A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                  Waktu pengamatan
                </Text>
              </View>
              <Pressable
                onPress={() => setShowTimeEditor((v) => !v)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#11121A' }}>
                  {showTimeEditor ? 'Tutup' : 'Ubah'}
                </Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#11121A' }}>
              {formatTimeWithZone(report.observationTime, report.timezone)}
            </Text>

            {showTimeEditor ? (
              <View style={{ gap: 8, marginTop: 8 }}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#656575', marginBottom: 2 }}>
                    Waktu (ISO timestamp)
                  </Text>
                  <TextInput
                    value={report.observationTime}
                    onChangeText={(text) => update({ observationTime: text })}
                    placeholder="2026-10-29T12:00:00+07:00"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    style={{ fontSize: 13, color: '#11121A' }}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#656575', marginBottom: 2 }}>
                    Zona waktu
                  </Text>
                  <TextInput
                    value={report.timezone}
                    onChangeText={(text) => update({ timezone: text })}
                    placeholder="Asia/Jakarta"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    style={{ fontSize: 13, color: '#11121A' }}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {/* BOTTOM BUTTON: SIMPAN LOKASI */}
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Simpan lokasi dan kembali"
            style={({ pressed }) => [
              {
                backgroundColor: '#11121A',
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.88 : 1,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
              Simpan lokasi
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
