/**
 * Draft detail aligned with approved Figma design.
 * Features:
 * - Honest share activity labels ("Upaya berbagi dibatalkan", "Pilihan berbagi dibuka").
 * - Sender Selfie status and thumbnail display.
 * - Cyan, Peach, and White card presentation.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, Image, Alert, Pressable } from 'react-native';
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
import { services, Report, ShareAttempt } from '../../../src/ui/services';
import { formatShortDate, formatTimeWithZone } from '../../../src/ui/format';

function shareEventLabel(e: ShareAttempt['event']): string {
  switch (e) {
    case 'share_sheet_opened': return 'Pilihan berbagi dibuka';
    case 'handoff_observed': return 'Handoff teramati oleh sistem';
    case 'cancelled': return 'Upaya berbagi dibatalkan';
    default: return 'Tidak diketahui';
  }
}

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await services.getReport(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const del = useCallback(() => {
    Alert.alert(
      'Hapus draf',
      'Hapus draf dan foto dari Niragni? Foto asli di galeri tetap ada.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await services.deleteReport(id);
              router.back();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }, [id, router]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Detail draf" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          {error ? <Notice text={error} tone="error" /> : <Text style={{ color: t.textSecondary }}>Memuat…</Text>}
        </View>
      </Screen>
    );
  }

  const selfie = report.senderSelfie;

  return (
    <Screen>
      <FlowHeader
        title="Detail draf"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push(`/report/${id}/edit`)}
            style={{
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#DFDEE5',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#11121A' }}>
              Edit
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Notice text={error} tone="error" /> : null}

        {/* RINGKASAN CARD (CYAN) */}
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
            Ringkasan pengamatan
          </Text>
          <Text style={{ fontSize: 14, color: '#11121A', lineHeight: 20 }}>
            {report.reviewedText?.trim() || report.rawText?.trim() || 'Belum ada isi laporan.'}
          </Text>
        </View>

        {/* RINCIAN CARD (PEACH) */}
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
            Waktu & Lokasi
          </Text>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 11, color: '#656575' }}>Waktu pengamatan</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#11121A' }}>
              {formatTimeWithZone(report.observationTime, report.timezone)}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 11, color: '#656575' }}>Lokasi kejadian</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#11121A' }}>
              {report.incidentLocationText?.trim() || 'Belum diisi'}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 11, color: '#656575' }}>Posisi pelapor</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#11121A' }}>
              {report.includeObserverLocation && report.observerLocation
                ? `Terisi (Lat ${report.observerLocation.latitude.toFixed(5)}, Lon ${report.observerLocation.longitude.toFixed(5)})`
                : 'Tidak disertakan'}
            </Text>
          </View>
        </View>

        {/* SENDER SELFIE CARD (WHITE) */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
              Foto Pengirim (Selfie)
            </Text>
            <StatusPill
              label={selfie ? 'Tersedia' : 'Belum diisi'}
              kind={selfie ? 'positive' : 'warn'}
            />
          </View>

          {selfie ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Image
                source={{ uri: selfie.uri }}
                style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#E0E0E0' }}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#11121A' }}>
                  Foto pengirim · identitas belum diverifikasi
                </Text>
                <Text style={{ fontSize: 11, color: '#656575', marginTop: 2 }}>
                  Tersimpan di perangkat lokal
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: '#656575' }}>
              Swafoto belum diambil. Wajib diambil sebelum laporan dibagikan.
            </Text>
          )}
        </View>

        {/* FOTO KEJADIAN CARD (WHITE) */}
        {report.attachments.length > 0 ? (
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
              Foto Kejadian ({report.attachments.length})
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {report.attachments.map((a, i) => (
                <View key={a.id} style={{ alignItems: 'center', gap: 4 }}>
                  <Image
                    source={{ uri: a.uri }}
                    accessibilityLabel={`Foto kejadian ${i + 1}`}
                    style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#E0E0E0' }}
                    resizeMode="cover"
                  />
                  <Text style={{ fontSize: 10, color: '#656575' }}>
                    {a.selectedForShare ? 'Dipilih' : 'Tidak'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* AKTIVITAS BERBAGI (WHITE) */}
        <View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 18,
              marginBottom: space.xl,
              gap: 10,
            },
            t.cardShadow,
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
            Aktivitas berbagi
          </Text>
          {report.shareAttempts.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#656575' }}>
              Laporan belum pernah dibagikan dari aplikasi ini.
            </Text>
          ) : (
            report.shareAttempts.map((s) => (
              <View
                key={s.id}
                style={{
                  backgroundColor: '#F8F9FA',
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                {/* HONEST LABEL: Upaya berbagi dibatalkan / Pilihan berbagi dibuka */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#11121A' }}>
                  {shareEventLabel(s.event)} · {formatShortDate(s.at)}
                </Text>
                <Text style={{ fontSize: 11, color: '#656575' }}>
                  Penerimaan belum diketahui (tidak ada bukti tanda terima otomatis).
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ACTION BUTTONS */}
        <Pressable
          onPress={() => router.push(`/report/${id}/share`)}
          accessibilityRole="button"
          accessibilityLabel="Buka pilihan berbagi"
          style={({ pressed }) => [
            {
              backgroundColor: '#11121A',
              height: 50,
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.sm,
              opacity: pressed ? 0.88 : 1,
            },
            t.cardShadow,
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
            Buka pilihan berbagi
          </Text>
        </Pressable>

        <Pressable
          onPress={del}
          accessibilityRole="button"
          accessibilityLabel="Hapus draf laporan"
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '600' }}>
            Hapus draf
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
