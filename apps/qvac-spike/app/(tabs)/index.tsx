/**
 * Reports home. Title, a brief AI-readiness line (checked locally, never
 * assumed), the primary CTA "Buat laporan", and the draft list. Empty state
 * guides the user. List rows show place/time/local status — not a sent badge.
 * Telephone help is always reachable from here (the Kanal bantuan tab).
 */
import React, { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Screen, Heading, Body, Caption, Label, Button, ListRow, StatusPill, Notice, Row, useTheme, space,
} from '../../src/ui/components';
import { services, Report, ModelState } from '../../src/ui/services';
import { formatShortDate } from '../../src/ui/format';

export default function ReportsHome() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [models, setModels] = useState<ModelState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rs, ms] = await Promise.all([services.listReports(), services.listModels()]);
      setReports(rs);
      setModels(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const anyReady = models.some((m) => m.status === 'ready');
  const aiLine = anyReady
    ? 'AI lokal siap. Anda tetap mengendalikan isi laporan.'
    : 'AI belum siap offline. Anda tetap bisa membuat dan menyimpan laporan.';

  const createReport = useCallback(async () => {
    try {
      const r = await services.createReport();
      router.push(`/report/${r.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Report }) => {
    const place = item.incidentLocationText?.trim() || 'Lokasi belum diisi';
    const share = item.shareAttempts?.length
      ? 'Pilihan berbagi pernah dibuka'
      : 'Belum dibagikan';
    return (
      <ListRow
        onPress={() => router.push(`/report/${item.id}`)}
        accessibilityLabel={`Draf ${place}, ${formatShortDate(item.updatedAt)}`}
        accessibilityHint="Buka detail draf"
      >
        <Body>{place}</Body>
        <Caption style={{ marginTop: 2 }}>Diperbarui {formatShortDate(item.updatedAt)}</Caption>
        <Row style={{ marginTop: space.sm }}>
          <StatusPill label="Tersimpan lokal" kind="neutral" />
          <Caption>{share}</Caption>
        </Row>
      </ListRow>
    );
  }, [router]);

  return (
    <Screen>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.textSecondary} />}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xxl,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <Heading>Laporan</Heading>
            <Caption style={{ marginTop: space.xs, marginBottom: space.md }}>{aiLine}</Caption>
            {error ? <Notice text={`Gagal memuat data: ${error}`} tone="error" /> : null}
            <Button
              title="Buat laporan"
              onPress={createReport}
              accessibilityHint="Membuka form laporan baru"
            />
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <ListRow role="text" accessibilityLabel="Belum ada draf">
              <Label>Belum ada draf</Label>
              <Caption style={{ marginTop: space.xs }}>
                Catat pengamatan Anda saat diperlukan.
              </Caption>
            </ListRow>
          )
        }
      />
    </Screen>
  );
}
