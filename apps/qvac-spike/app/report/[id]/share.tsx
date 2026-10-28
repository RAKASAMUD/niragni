/**
 * Pilih kanal. Shows the export preview (text + selected photos + whether
 * precise location is included), the national/validated channels, and actions:
 * open the OS share sheet, copy text, or open the dialer. All require an
 * explicit tap; the app never claims the report was received. Channel source
 * and date are openable.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Screen, Body, Caption, Label, Button, Card, StatusPill, Notice, Row, Divider, useTheme, space, radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, Report, Channel, ExportPreview } from '../../../src/ui/services';
import { formatShortDate } from '../../../src/ui/format';

export default function Share() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await services.getReport(id);
      setReport(r);
      setChannels(services.listChannels());
      if (r) setPreview(await services.previewExport(r));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const share = useCallback(async (channelId?: string) => {
    if (!report) return;
    try {
      await services.shareReport(report, channelId);
      setNotice('Pilihan berbagi telah dibuka. Bara belum mengetahui apakah laporan diterima.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [report, load]);

  const copy = useCallback(async () => {
    if (!report) return;
    try { await services.copyReport(report); setNotice('Teks laporan disalin.'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [report]);

  const dial = useCallback(async (c: Channel) => {
    try { await services.openDialer(c.id); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  const openSource = useCallback((url: string) => { void Linking.openURL(url).catch(() => {}); }, []);

  return (
    <Screen>
      <FlowHeader title="Pilih kanal" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}>
        {error ? <Notice text={error} tone="error" /> : null}
        {notice ? <Notice text={notice} tone="info" /> : null}

        {/* Export preview */}
        <Label>Pratinjau yang akan dibagikan</Label>
        <Card style={{ marginTop: space.xs }}>
          <Body>{preview?.text?.trim() || report?.reviewedText?.trim() || 'Belum ada teks laporan.'}</Body>
          {preview?.photoUris?.length ? (
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              {preview.photoUris.map((uri, i) => (
                <Image key={i} source={{ uri }} accessibilityLabel={`Foto ekspor ${i + 1}`}
                  style={{ width: 64, height: 64, borderRadius: radius.input, backgroundColor: t.border }} />
              ))}
            </Row>
          ) : (
            <Caption style={{ marginTop: space.sm }}>Tidak ada foto dipilih untuk dibagikan.</Caption>
          )}
          <Caption style={{ marginTop: space.sm }}>
            Posisi tepat: {report?.includeObserverLocation ? 'disertakan' : 'tidak disertakan'}
          </Caption>
        </Card>

        <Row style={{ marginTop: space.md }}>
          <Button title="Buka pilihan berbagi" onPress={() => share()} style={{ flex: 1 }}
            accessibilityHint="Membuka lembar berbagi sistem" />
          <Button title="Salin teks" variant="secondary" onPress={copy} style={{ flex: 1 }} />
        </Row>

        <Divider />

        {/* Channels */}
        <Label>Kanal</Label>
        {channels.length === 0 ? (
          <Caption style={{ marginTop: space.xs }}>Belum ada kanal tersimpan.</Caption>
        ) : (
          channels.map((c) => (
            <Card key={c.id} style={{ marginTop: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ flex: 1, fontWeight: '700' }}>{c.label}</Body>
                <StatusPill label={c.availability === 'public' ? 'Publik' : 'Belum terkonfirmasi'} kind={c.availability === 'public' ? 'positive' : 'warn'} />
              </Row>
              <Caption style={{ marginTop: space.xs }}>{c.destination} · Cakupan: {c.scope}</Caption>
              <Caption style={{ marginTop: space.xs }}>Sumber diperiksa: {formatShortDate(c.checkedAt)}</Caption>
              <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                {c.kind === 'phone' ? (
                  <Button title="Buka dialer" variant="destructive" onPress={() => dial(c)} style={{ flexGrow: 1 }}
                    accessibilityLabel={`Buka dialer ke ${c.label}`} accessibilityHint="Tidak menelepon otomatis" />
                ) : (
                  <Button title="Bagikan ke kanal" variant="secondary" onPress={() => share(c.id)} style={{ flexGrow: 1 }} />
                )}
                <Button title="Sumber & tanggal" variant="quiet" onPress={() => openSource(c.sourceUrl)} style={{ flexGrow: 1 }} />
              </Row>
            </Card>
          ))
        )}

        <Caption style={{ marginTop: space.lg, textAlign: 'center' }}>
          Membuka pilihan berbagi atau dialer bukan bukti laporan diterima.
        </Caption>
      </ScrollView>
    </Screen>
  );
}
