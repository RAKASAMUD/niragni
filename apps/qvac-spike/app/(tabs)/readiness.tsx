/**
 * Kesiapan offline — model readiness. Per candidate: name, size, required free
 * space, status, and local check. Download when ready; cancel/pause only if the
 * adapter supports it; import a local file; check (real local load, not a
 * network assumption); delete the model separately from drafts. Free-space and
 * size messages are explicit.
 */
import React, { useCallback, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Screen, Heading, Body, Caption, Label, Button, Card, StatusPill, Notice, Row, space,
} from '../../src/ui/components';
import { services, ModelState } from '../../src/ui/services';
import { formatBytes, formatTimeWithZone } from '../../src/ui/format';

type PillKind = 'neutral' | 'positive' | 'busy' | 'warn' | 'error';
function statusPill(status: ModelState['status']): { label: string; kind: PillKind } {
  switch (status) {
    case 'ready': return { label: 'Siap offline', kind: 'positive' };
    case 'installed': return { label: 'Terpasang (perlu cek lokal)', kind: 'warn' };
    case 'downloading': return { label: 'Mengunduh…', kind: 'busy' };
    case 'verifying': return { label: 'Memverifikasi…', kind: 'busy' };
    case 'failed': return { label: 'Gagal', kind: 'error' };
    case 'incompatible': return { label: 'Tidak kompatibel', kind: 'error' };
    default: return { label: 'Belum diunduh', kind: 'neutral' };
  }
}

export default function Readiness() {
  const insets = useSafeAreaInsets();
  const [models, setModels] = useState<ModelState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setModels(await services.listModels());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onProgress = useCallback((state: ModelState) => {
    setModels((prev) => prev.map((m) => (m.candidateId === state.candidateId ? state : m)));
  }, []);

  const download = useCallback(async (m: ModelState) => {
    setBusyId(m.candidateId);
    try {
      const sizeMsg = `Perkiraan unduhan ${formatBytes(m.totalBytes || m.requiredBytes)}. Pastikan ruang kosong cukup.`;
      await new Promise<void>((resolve, reject) => {
        Alert.alert('Unduh model', sizeMsg, [
          { text: 'Batal', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
          { text: 'Unduh', onPress: () => resolve() },
        ]);
      });
      await services.downloadModel(m.candidateId, onProgress);
      await load();
    } catch (e) {
      if (e instanceof Error && e.message !== 'cancelled') setError(e.message);
    } finally {
      setBusyId(null);
    }
  }, [load, onProgress]);

  const cancelDownload = useCallback(async () => {
    try { await services.cancelModelDownload(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [load]);

  const importLocal = useCallback(async (m: ModelState) => {
    setBusyId(m.candidateId);
    try { await services.importModel(m.candidateId, onProgress); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  }, [load, onProgress]);

  const check = useCallback(async (m: ModelState) => {
    setBusyId(m.candidateId);
    try { const s = await services.checkModel(m.candidateId); onProgress(s); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  }, [onProgress]);

  const remove = useCallback((m: ModelState) => {
    Alert.alert(
      'Hapus model?',
      'Hanya berkas model yang dihapus. Draf laporan Anda tidak terpengaruh.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: async () => {
            try { await services.deleteModel(m.candidateId); await load(); }
            catch (e) { setError(e instanceof Error ? e.message : String(e)); }
          },
        },
      ],
    );
  }, [load]);

  const renderItem = useCallback(({ item }: { item: ModelState }) => {
    const pill = statusPill(item.status);
    const isBusy = busyId === item.candidateId || item.status === 'downloading' || item.status === 'verifying';
    const pct = item.totalBytes > 0 ? Math.min(100, Math.round((item.downloadedBytes / item.totalBytes) * 100)) : 0;
    return (
      <Card style={{ marginBottom: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ flex: 1, fontWeight: '700' }}>{item.name}</Body>
          <StatusPill label={pill.label} kind={pill.kind} />
        </Row>
        <Caption style={{ marginTop: space.xs }}>Ukuran total: {formatBytes(item.totalBytes)}</Caption>
        <Caption style={{ marginTop: space.xs }}>Ruang diperlukan: {formatBytes(item.requiredBytes)}</Caption>
        {item.lastLocalCheck ? (
          <Caption style={{ marginTop: space.xs }}>Pemeriksaan lokal terakhir: {formatTimeWithZone(item.lastLocalCheck, undefined)}</Caption>
        ) : (
          <Caption style={{ marginTop: space.xs }}>Belum ada pemeriksaan lokal.</Caption>
        )}
        {item.status === 'downloading' ? (
          <Caption style={{ marginTop: space.xs }}>Progres: {pct}% ({formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)})</Caption>
        ) : null}
        {item.error ? <Notice text={item.error} tone="error" /> : null}

        <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          {item.status === 'missing' || item.status === 'failed' ? (
            <Button title="Unduh" onPress={() => download(item)} loading={isBusy} style={{ flexGrow: 1 }}
              accessibilityHint="Menampilkan ukuran sebelum mengunduh" />
          ) : null}
          {item.status === 'downloading' ? (
            <Button title="Batalkan unduhan" variant="secondary" onPress={cancelDownload} style={{ flexGrow: 1 }} />
          ) : null}
          <Button title="Impor berkas" variant="secondary" onPress={() => importLocal(item)} loading={isBusy} style={{ flexGrow: 1 }} />
          <Button title="Periksa lokal" variant="secondary" onPress={() => check(item)} loading={isBusy} style={{ flexGrow: 1 }}
            accessibilityHint="Memuat model secara lokal untuk memastikan kesiapan" />
          {item.status !== 'missing' ? (
            <Button title="Hapus model" variant="destructive" onPress={() => remove(item)} style={{ flexGrow: 1 }} />
          ) : null}
        </Row>
      </Card>
    );
  }, [busyId, download, cancelDownload, importLocal, check, remove]);

  return (
    <Screen>
      <FlatList
        data={models}
        keyExtractor={(m) => m.candidateId}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xxl,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <Heading>Kesiapan offline</Heading>
            <Caption style={{ marginTop: space.xs }}>
              Status "siap" muncul hanya setelah pemeriksaan lokal berhasil, bukan asumsi.
            </Caption>
            {error ? <Notice text={error} tone="error" /> : null}
          </View>
        }
        ListEmptyComponent={<Card><Label>Belum ada model terdaftar.</Label></Card>}
      />
    </Screen>
  );
}
