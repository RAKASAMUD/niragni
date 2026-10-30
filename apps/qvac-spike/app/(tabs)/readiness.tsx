/**
 * Kesiapan offline tab aligned with approved Figma design.
 * Features:
 * - BrandHeader with Niragni branding.
 * - Cyan hero card: "Siapkan sebelum diperlukan. AI tetap opsional."
 * - Visual model cards with status pills and honest offline checks.
 * - Non-blocking manual reporting guidance.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Alert, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  BrandHeader,
  StatusPill,
  Notice,
  useTheme,
  space,
  radius,
} from '../../src/ui/components';
import { services, ModelState } from '../../src/ui/services';
import { createReadinessPoller, ReadinessPoller } from '../../src/ui/loadReadinessData';
import { formatBytes, formatTimeWithZone, formatIndonesianHeaderDate } from '../../src/ui/format';

type PillKind = 'neutral' | 'positive' | 'busy' | 'warn' | 'error';
function statusPill(status: ModelState['status']): { label: string; kind: PillKind } {
  switch (status) {
    case 'ready': return { label: 'Lolos cek lokal', kind: 'positive' };
    case 'installed': return { label: 'Perlu cek lokal', kind: 'warn' };
    case 'downloading': return { label: 'Mengunduh', kind: 'busy' };
    case 'verifying': return { label: 'Memverifikasi', kind: 'busy' };
    case 'failed': return { label: 'Gagal', kind: 'error' };
    case 'incompatible': return { label: 'Tidak kompatibel', kind: 'error' };
    default: return { label: 'Belum diunduh', kind: 'neutral' };
  }
}

export default function Readiness() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTheme();
  const [models, setModels] = useState<ModelState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const pollerRef = useRef<ReadinessPoller | null>(null);
  if (!pollerRef.current) {
    pollerRef.current = createReadinessPoller(services, {
      setModels: (nextModels) => setModels(nextModels),
      setError: (err) => setError(err),
    });
  }

  const load = useCallback(async () => {
    if (pollerRef.current) {
      await pollerRef.current.poll();
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    // Manager owns active progress across route mounts. Poll only while focused.
    const interval = setInterval(() => { void load(); }, 1000);
    return () => {
      clearInterval(interval);
      pollerRef.current?.reset();
    };
  }, [load]));

  const onProgress = useCallback((state: ModelState) => {
    setModels((prev) => prev.map((m) => (m.candidateId === state.candidateId ? state : m)));
  }, []);

  const runDownload = useCallback(async (m: ModelState) => {
    setConfirmId(null);
    setBusyId(m.candidateId);
    setError(null);
    try {
      await services.downloadModel(m.candidateId, onProgress);
      await load();
    } catch (e) {
      if (e instanceof Error && e.message !== 'cancelled') setError(e.message);
    } finally {
      setBusyId(null);
    }
  }, [load, onProgress]);

  const cancelDownload = useCallback(async () => {
    setError(null);
    try {
      await services.cancelModelDownload();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [load]);

  const importLocal = useCallback(async (m: ModelState) => {
    setBusyId(m.candidateId);
    setError(null);
    try {
      await services.importModel(m.candidateId, onProgress);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [load, onProgress]);

  const check = useCallback(async (m: ModelState) => {
    setBusyId(m.candidateId);
    setError(null);
    try {
      const s = await services.checkModel(m.candidateId);
      onProgress(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [onProgress]);

  const remove = useCallback((m: ModelState) => {
    Alert.alert(
      'Hapus model?',
      'Hanya berkas model yang dihapus. Draf laporan Anda tidak terpengaruh.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await services.deleteModel(m.candidateId);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }, [load]);

  const renderItem = useCallback(({ item }: { item: ModelState }) => {
    const pill = statusPill(item.status);
    const isBusy = busyId === item.candidateId || item.status === 'downloading' || item.status === 'verifying';
    const pct = item.totalBytes > 0 ? Math.min(100, Math.round((item.downloadedBytes / item.totalBytes) * 100)) : 0;
    const confirming = confirmId === item.candidateId;
    const needsDownload = item.status === 'missing' || item.status === 'failed';

    return (
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="hardware-chip-outline" size={18} color="#11121A" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '500', color: '#11121A' }}>
              {item.name}
            </Text>
          </View>
          <StatusPill label={pill.label} kind={pill.kind} />
        </View>

        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 12, color: '#11121A' }}>
            Model + projector · {formatBytes(item.totalBytes || item.requiredBytes)}
          </Text>
          <Text style={{ fontSize: 11, color: '#465257' }}>
            Ruang diperlukan diperiksa sebelum unduh.
          </Text>
          {item.lastLocalCheck ? (
            <Text style={{ fontSize: 11, color: '#465257' }}>
              Dicek lokal: {formatTimeWithZone(item.lastLocalCheck, undefined)}
            </Text>
          ) : null}
          {item.status === 'downloading' ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#11121A', marginTop: 4 }}>
              {pct}% · {formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}
            </Text>
          ) : null}
        </View>

        {item.status === 'verifying' ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: '#11121A' }}>
            {item.verifiedBytes !== undefined && item.verifiedBytes < item.totalBytes
              ? `Memeriksa SHA-256: ${formatBytes(item.verifiedBytes)} / ${formatBytes(item.totalBytes)}`
              : item.verifiedBytes !== undefined && item.verifiedBytes >= item.totalBytes
                ? 'SHA-256 selesai. Menguji pemuatan model di perangkat…'
                : `Memeriksa SHA-256… · ${formatBytes(item.totalBytes || item.requiredBytes)}`}
          </Text>
        ) : null}

        {item.error ? (
          <View style={{ marginTop: 4 }}>
            <Notice text={item.error} tone="error" />
          </View>
        ) : null}

        {/* Inline confirmation */}
        {confirming ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 14,
              marginTop: 6,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 12, color: '#11121A' }}>
              Perkiraan unduhan {formatBytes(item.totalBytes || item.requiredBytes)}. Pastikan ruang penyimpanan dan kuota cukup.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => runDownload(item)}
                style={{
                  flex: 1,
                  backgroundColor: '#11121A',
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                  Unduh sekarang
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmId(null)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#11121A', fontSize: 12, fontWeight: '600' }}>
                  Batal
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 4 }}>
            {needsDownload ? (
              <Pressable
                onPress={() => setConfirmId(item.candidateId)}
                accessibilityRole="button"
                accessibilityLabel="Unduh model"
                style={({ pressed }) => [
                  {
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
                  Unduh model
                </Text>
              </Pressable>
            ) : item.status === 'downloading' || item.status === 'verifying' ? (
              <Pressable
                onPress={cancelDownload}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                }}
              >
                <Text style={{ color: '#11121A', fontSize: 13, fontWeight: '700' }}>
                  {item.status === 'verifying' ? 'Batalkan verifikasi' : 'Batalkan unduhan'}
                </Text>
              </Pressable>
            ) : item.status === 'installed' ? (
              <Pressable
                onPress={() => check(item)}
                disabled={isBusy}
                style={{
                  backgroundColor: '#11121A',
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {isBusy ? 'Memeriksa…' : 'Periksa model lokal'}
                </Text>
              </Pressable>
            ) : item.status === 'ready' ? (
              <Pressable
                onPress={() => check(item)}
                disabled={isBusy}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                }}
              >
                <Text style={{ color: '#11121A', fontSize: 13, fontWeight: '700' }}>
                  {isBusy ? 'Memeriksa…' : 'Cek ulang lokal'}
                </Text>
              </Pressable>
            ) : null}

            {needsDownload ? (
              <Pressable
                onPress={() => importLocal(item)}
                disabled={isBusy}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: '#11121A', fontSize: 12, fontWeight: '600' }}>
                  Impor berkas yang sudah tersedia →
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => remove(item)}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: '#991B1B', fontSize: 12, fontWeight: '600' }}>
                  Hapus berkas model
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }, [busyId, confirmId, cancelDownload, check, importLocal, remove, runDownload, t]);

  return (
    <Screen>
      <FlatList
        data={models}
        keyExtractor={(m) => m.candidateId}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 96,
        }}
        ListHeaderComponent={
          <View>
            <BrandHeader subtitle={formatIndonesianHeaderDate()} />

            {/* Cyan Hero Card */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="cloud-offline-outline" size={18} color="#11121A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#11121A' }}>
                  Siapkan sebelum diperlukan
                </Text>
              </View>

              <Text style={{ fontSize: 22, fontWeight: '500', color: '#11121A', lineHeight: 28 }}>
                AI tetap opsional.
              </Text>
              <Text style={{ fontSize: 12, color: '#11121A', lineHeight: 17 }}>
                Anda bisa mencatat dan menyimpan laporan saat model belum siap. Laporan tetap disimpan lokal di perangkat.
              </Text>
            </View>

            {/* Inline notice card */}
            <View
              style={[
                {
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: space.lg,
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#11121A" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#263840', lineHeight: 17 }}>
                Status siap muncul setelah berkas lengkap, hash cocok, dan pemeriksaan muat lokal berhasil.
              </Text>
            </View>

            {error ? <Notice text={error} tone="error" /> : null}
          </View>
        }
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/')}
            style={({ pressed }) => [
              {
                backgroundColor: '#11121A',
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: space.sm,
                opacity: pressed ? 0.88 : 1,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
              Kembali ke laporan
            </Text>
          </Pressable>
        }
      />
    </Screen>
  );
}
