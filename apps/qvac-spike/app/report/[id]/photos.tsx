/**
 * Photos screen aligned with approved Figma design.
 * Features:
 * 1. Dedicated Sender Selfie section (mandatory front-camera photo before share).
 * 2. Event Photos (max 3, <= 20 MB each) with honest label "Dipilih untuk dibagikan".
 * 3. Color styling: Cyan and Peach cards with clean touch targets.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  StatusPill,
  Notice,
  useTheme,
  space,
  radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, Report, Attachment } from '../../../src/ui/services';
import { formatBytes, LIMITS } from '../../../src/ui/format';

export default function Photos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await services.getReport(id);
      if (!isMountedRef.current) return;
      setReport(r);
      setError(null);
    } catch (e) {
      if (!isMountedRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const r = await services.getReport(id);
          if (!isActive) return;
          setReport(r);
          setError(null);
        } catch (e) {
          if (!isActive) return;
          setError(e instanceof Error ? e.message : String(e));
        }
      })();
      return () => {
        isActive = false;
      };
    }, [id])
  );

  const count = report?.attachments?.length ?? 0;
  const atLimit = count >= LIMITS.maxPhotos;
  const selfie = report?.senderSelfie;

  const add = useCallback(async (source: 'camera' | 'library') => {
    if (atLimit) {
      Alert.alert('Batas foto', `Maksimal ${LIMITS.maxPhotos} foto kejadian per draf.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const att = await services.addPhoto(id, source);
      if (att) {
        await load();
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const isCloudOnly = /cloud-only|tidak dapat diakses/i.test(raw);
      setError(
        isCloudOnly
          ? 'Foto ini belum tersedia di perangkat. Pilih foto lokal atau coba saat terhubung.'
          : raw
      );
    } finally {
      setBusy(false);
    }
  }, [atLimit, id, load]);

  const removePhoto = useCallback((att: Attachment) => {
    Alert.alert(
      'Hapus foto',
      'Hapus foto ini dari draf? Foto asli di galeri tetap ada.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await services.removePhoto(id, att.id);
              setReport(updated);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }, [id]);

  const toggleShare = useCallback(async (att: Attachment) => {
    if (!report) return;
    const nextAttachments = report.attachments.map((a) =>
      a.id === att.id ? { ...a, selectedForShare: !a.selectedForShare } : a
    );
    try {
      const stored = await services.saveReport({ ...report, attachments: nextAttachments });
      setReport(stored);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [report]);

  const handleCaptureSelfie = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await services.captureSenderSelfie(id);
      if (result) {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id, load]);

  const handleRemoveSelfie = useCallback(() => {
    Alert.alert(
      'Hapus selfie pengirim',
      'Hapus foto selfie pengirim dari draf ini? Anda harus mengambil selfie lagi sebelum berbagi laporan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await services.removeSenderSelfie(id);
              setReport(updated);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }, [id]);

  return (
    <Screen>
      <FlowHeader
        title="Foto laporan"
        onBack={() => router.back()}
        helpActionLabel="Kanal bantuan"
        onHelp={() => router.push('/channels')}
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 12, color: '#656575', marginBottom: space.md }}>
          Pilih foto lokal. Maksimal 3 foto kejadian; 20 MB per foto.
        </Text>

        {error ? <Notice text={error} tone="error" /> : null}

        {/* SECTION 1: SENDER SELFIE CARD (PEACH) */}
        <View
          style={[
            {
              backgroundColor: t.peach,
              borderRadius: 24,
              padding: 18,
              marginBottom: space.lg,
              gap: 12,
            },
            t.cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-circle-outline" size={22} color="#11121A" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Foto Pengirim (Selfie)
              </Text>
            </View>
            <StatusPill
              label={selfie ? 'Tersedia' : 'Wajib'}
              kind={selfie ? 'positive' : 'warn'}
            />
          </View>

          <Text style={{ fontSize: 12, color: '#465257', lineHeight: 17 }}>
            Wajib swafoto kamera depan sebelum berbagi. Foto pengirim tidak dikirim ke AI dan disimpan lokal di perangkat.
          </Text>

          {selfie ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 12,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <Image
                source={{ uri: selfie.uri }}
                style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#E0E0E0' }}
                resizeMode="cover"
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#11121A' }}>
                  Foto pengirim · identitas belum diverifikasi
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={handleCaptureSelfie}
                    style={{
                      backgroundColor: '#F0F0F0',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#11121A' }}>
                      Foto ulang
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRemoveSelfie}
                    style={{
                      backgroundColor: '#FEE2E2',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#991B1B' }}>
                      Hapus
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleCaptureSelfie}
              accessibilityRole="button"
              accessibilityLabel="Ambil selfie pengirim dengan kamera depan"
              style={({ pressed }) => [
                {
                  backgroundColor: '#11121A',
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: pressed ? 0.88 : 1,
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                Ambil selfie pengirim
              </Text>
            </Pressable>
          )}
        </View>

        {/* SECTION 2: EVENT PHOTOS (CYAN) */}
        <View
          style={[
            {
              backgroundColor: t.cyan,
              borderRadius: 24,
              padding: 18,
              marginBottom: space.lg,
              gap: 12,
            },
            t.cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="images-outline" size={20} color="#11121A" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
              Foto Kejadian ({count} dari {LIMITS.maxPhotos})
            </Text>
          </View>

          {count === 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: '#656575' }}>
                Belum ada foto kejadian pada draf ini.
              </Text>
            </View>
          ) : (
            report!.attachments.map((att, i) => (
              <View
                key={att.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Image
                    source={{ uri: att.uri }}
                    accessibilityLabel={`Foto kejadian ${i + 1}`}
                    style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: '#E0E0E0' }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#11121A' }}>
                        Foto {i + 1}
                      </Text>
                      {/* HONEST LABEL: Dipilih untuk dibagikan (not "Dibagikan") */}
                      <StatusPill
                        label={att.selectedForShare ? 'Dipilih untuk dibagikan' : 'Tidak dipilih'}
                        kind={att.selectedForShare ? 'positive' : 'neutral'}
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: '#656575', marginTop: 4 }}>
                      {att.source === 'camera' ? 'Kamera' : 'Galeri'} · {att.width}×{att.height} · {formatBytes(att.bytes)}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <Pressable
                    onPress={() => toggleShare(att)}
                    style={{
                      backgroundColor: att.selectedForShare ? '#F0F0F0' : '#E8F5E9',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: att.selectedForShare ? '#11121A' : '#1B5E20' }}>
                      {att.selectedForShare ? 'Batalkan pilih' : 'Pilih untuk dibagikan'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removePhoto(att)}
                    style={{
                      backgroundColor: '#FEE2E2',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#991B1B' }}>
                      Hapus dari draf
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* SECTION 3: ADD EVENT PHOTO CARD (PEACH) */}
        <View
          style={[
            {
              backgroundColor: t.peach,
              borderRadius: 24,
              padding: 18,
              marginBottom: space.xl,
              gap: 12,
            },
            t.cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera-outline" size={22} color="#11121A" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
              Tambah foto kejadian
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => add('camera')}
              disabled={atLimit || busy}
              accessibilityRole="button"
              accessibilityLabel="Ambil foto kejadian dengan kamera"
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: atLimit ? 'rgba(0,0,0,0.1)' : '#11121A',
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  opacity: pressed ? 0.88 : 1,
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="camera" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                Ambil foto
              </Text>
            </Pressable>

            <Pressable
              onPress={() => add('library')}
              disabled={atLimit || busy}
              accessibilityRole="button"
              accessibilityLabel="Pilih foto kejadian dari galeri"
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                  opacity: pressed ? 0.88 : 1,
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="images" size={16} color="#11121A" />
              <Text style={{ color: '#11121A', fontSize: 13, fontWeight: '700' }}>
                Dari galeri
              </Text>
            </Pressable>
          </View>
        </View>

        {/* BOTTOM ACTION */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Simpan pilihan foto dan kembali"
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
            Simpan pilihan foto
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
