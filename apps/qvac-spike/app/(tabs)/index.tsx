/**
 * Reports home. Aligned with approved Figma design:
 * Brand header with original logo, cyan hero card ("Melihat Asap?"),
 * and peach draft cards ("Draf lokal").
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  BrandHeader,
  InlineNotice,
  useTheme,
  space,
  radius,
} from '../../src/ui/components';
import { services, Report, ModelState } from '../../src/ui/services';
import { formatShortDate, formatIndonesianHeaderDate } from '../../src/ui/format';

import { loadHomeData } from '../../src/ui/loadHomeData';

export default function ReportsHome() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [models, setModels] = useState<ModelState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatingRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    await loadHomeData(services, {
      reports: rs => { if (version === loadVersion.current) setReports(rs); },
      models: ms => { if (version === loadVersion.current) setModels(ms); },
      reportError: e => { if (version === loadVersion.current) setError(e instanceof Error ? e.message : String(e)); },
      modelError: () => { if (version === loadVersion.current) setModels([]); },
      reportsDone: () => { if (version === loadVersion.current) setLoading(false); },
    });
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const anyReady = models.some((m) => m.status === 'ready');

  const createReport = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const r = await services.createReport();
      router.push(`/report/${r.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Report }) => {
    const place = item.incidentLocationText?.trim() || 'Lokasi belum diisi';
    const title = item.rawText?.trim()
      ? item.rawText.trim().split('\n')[0]
      : (item.suggestion?.summary ? item.suggestion.summary : 'Draf pengamatan');
    const hasShared = (item.shareAttempts?.length ?? 0) > 0;

    return (
      <Pressable
        onPress={() => router.push(`/report/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Draf ${place}, diperbarui ${formatShortDate(item.updatedAt)}`}
        accessibilityHint="Buka detail draf"
        style={({ pressed }) => [
          {
            backgroundColor: t.peach,
            borderRadius: 26,
            padding: 18,
            marginBottom: space.md,
            gap: 10,
            opacity: pressed ? 0.92 : 1,
          },
          t.cardShadow,
        ]}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#11121A' }}>
            {hasShared ? 'Upaya berbagi dicatat' : 'Draf lokal'}
          </Text>
        </View>

        <Text
          numberOfLines={2}
          style={{
            fontSize: 20,
            fontWeight: '500',
            color: '#11121A',
            lineHeight: 26,
            letterSpacing: 0.1,
          }}
        >
          {title}
        </Text>

        <Text style={{ fontSize: 12, color: '#465257' }}>
          {place}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 11, color: '#465257' }}>
            Diperbarui {formatShortDate(item.updatedAt)}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#11121A' }}>
            Buka draf  →
          </Text>
        </View>
      </Pressable>
    );
  }, [router, t]);

  return (
    <Screen>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.textSecondary} />}
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
                  borderRadius: 27,
                  padding: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: space.xl,
                  overflow: 'hidden',
                },
                t.cardShadow,
              ]}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '500',
                    color: '#11121A',
                    lineHeight: 34,
                    letterSpacing: 0.2,
                    marginBottom: 8,
                  }}
                >
                  Melihat Asap?
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#11121A',
                    lineHeight: 16,
                    marginBottom: 16,
                  }}
                >
                  Catat pengamatan Anda.{'\n'}Foto bisa ditambahkan nanti.
                </Text>

                <Pressable
                  onPress={createReport}
                  disabled={creating}
                  accessibilityState={{ busy: creating, disabled: creating }}
                  accessibilityRole="button"
                  accessibilityLabel="Buat laporan"
                  accessibilityHint="Membuka form laporan baru"
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#11121A',
                      borderRadius: 25,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      alignSelf: 'flex-start',
                      opacity: pressed ? 0.88 : 1,
                    },
                    t.cardShadow,
                  ]}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    {creating ? 'Membuat draf…' : 'Buat laporan'}
                  </Text>
                </Pressable>
              </View>

              {/* Tilted Paper Illustration */}
              <View
                style={{
                  width: 92,
                  height: 120,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 78,
                    height: 104,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 12,
                    transform: [{ rotate: '8deg' }],
                    shadowColor: '#121F26',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    elevation: 3,
                    justifyContent: 'space-between',
                  }}
                >
                  <Ionicons name="document-text-outline" size={26} color="#11121A" />
                  <View style={{ gap: 6 }}>
                    <View style={{ height: 5, width: 44, backgroundColor: '#D8C9FF', borderRadius: 3 }} />
                    <View style={{ height: 5, width: 30, backgroundColor: '#D8C9FF', borderRadius: 3 }} />
                  </View>
                </View>
              </View>
            </View>

            {!anyReady ? (
              <InlineNotice
                icon="cloud-offline-outline"
                text="AI belum siap offline. Anda tetap bisa membuat dan menyimpan laporan."
                actionLabel="Cek kesiapan"
                onAction={() => router.push('/readiness')}
              />
            ) : null}

            {error ? (
              <InlineNotice
                icon="alert-circle-outline"
                text={`Gagal memuat data: ${error}`}
              />
            ) : null}

            {/* Drafts heading */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: space.sm,
                marginBottom: space.md,
              }}
            >
              <Text style={{ fontSize: 21, fontWeight: '500', color: '#11121A', letterSpacing: 0.1 }}>
                Draf Anda
              </Text>
              <Text style={{ fontSize: 12, color: '#656575' }}>
                {reports.length > 0 ? `${reports.length} draf` : '0 draf'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View
              style={[
                {
                  backgroundColor: '#FFFFFF',
                  borderRadius: radius.card,
                  padding: space.xl,
                  alignItems: 'center',
                  gap: space.sm,
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="folder-open-outline" size={32} color="#656575" />
              <Text style={{ fontSize: 16, fontWeight: '500', color: '#11121A' }}>
                Belum ada draf
              </Text>
              <Text style={{ fontSize: 13, color: '#656575', textAlign: 'center' }}>
                Catat pengamatan Anda saat diperlukan. Laporan disimpan lokal di perangkat.
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
