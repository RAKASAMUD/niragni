/**
 * Draft detail. Current content, attachments, and share activity. Share
 * activity reads "Pilihan berbagi dibuka pada …; penerimaan belum diketahui."
 * Actions: edit, share again, delete (with confirmation that clarifies the
 * gallery original is kept).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Screen, Heading, Body, Caption, Label, Button, Card, StatusPill, Notice, Row, Divider, useTheme, space, radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, Report, ShareAttempt } from '../../../src/ui/services';
import { formatShortDate, formatTimeWithZone } from '../../../src/ui/format';

function shareEventLabel(e: ShareAttempt['event']): string {
  switch (e) {
    case 'share_sheet_opened': return 'Pilihan berbagi dibuka';
    case 'handoff_observed': return 'Handoff teramati oleh sistem';
    case 'cancelled': return 'Dibatalkan';
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
    try { setReport(await services.getReport(id)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const del = useCallback(() => {
    Alert.alert(
      'Hapus draf',
      'Hapus draf dan salinan fotonya dari Niragni? Foto asli di galeri tetap ada.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: async () => {
            try { await services.deleteReport(id); router.back(); }
            catch (e) { setError(e instanceof Error ? e.message : String(e)); }
          },
        },
      ],
    );
  }, [id, router]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Detail draf" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>{error ? <Notice text={error} tone="error" /> : <Caption>Memuat…</Caption>}</View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader
        title="Detail draf"
        onBack={() => router.back()}
        right={<Button title="Edit" variant="secondary" onPress={() => router.push(`/report/${id}/edit`)} style={{ paddingVertical: space.sm }} />}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}>
        {error ? <Notice text={error} tone="error" /> : null}
        <Row style={{ marginBottom: space.md }}>
          <StatusPill label="Tersimpan lokal" kind="neutral" />
        </Row>

        <Label>Ringkasan</Label>
        <Card style={{ marginTop: space.xs }}>
          <Body>{report.reviewedText?.trim() || report.rawText?.trim() || 'Belum ada isi.'}</Body>
        </Card>

        <View style={{ height: space.md }} />
        <Label>Waktu & lokasi</Label>
        <Card style={{ marginTop: space.xs }}>
          <Caption>Waktu pengamatan: {formatTimeWithZone(report.observationTime, report.timezone)}</Caption>
          <Caption style={{ marginTop: space.xs }}>Lokasi kejadian: {report.incidentLocationText?.trim() || 'Belum diisi'}</Caption>
          <Caption style={{ marginTop: space.xs }}>
            Posisi pelapor: {report.includeObserverLocation && report.observerLocation ? 'Terisi' : 'Tidak disertakan'}
          </Caption>
        </Card>

        {report.attachments.length > 0 ? (
          <>
            <View style={{ height: space.md }} />
            <Label>Lampiran</Label>
            <Row style={{ marginTop: space.xs, flexWrap: 'wrap' }}>
              {report.attachments.map((a, i) => (
                <Image key={a.id} source={{ uri: a.uri }} accessibilityLabel={`Lampiran foto ${i + 1}`}
                  style={{ width: 72, height: 72, borderRadius: radius.input, backgroundColor: t.border }} />
              ))}
            </Row>
          </>
        ) : null}

        <Divider />
        <Label>Aktivitas berbagi</Label>
        {report.shareAttempts.length === 0 ? (
          <Caption style={{ marginTop: space.xs }}>Laporan belum dibagikan dari aplikasi ini.</Caption>
        ) : (
          report.shareAttempts.map((s) => (
            <Card key={s.id} style={{ marginTop: space.sm }}>
              <Body>{shareEventLabel(s.event)} pada {formatShortDate(s.at)}</Body>
              <Caption style={{ marginTop: space.xs }}>Penerimaan belum diketahui.</Caption>
            </Card>
          ))
        )}

        <Divider />
        <Button title="Bagikan lagi" onPress={() => router.push(`/report/${id}/share`)} />
        <View style={{ height: space.sm }} />
        <Button title="Hapus draf" variant="destructive" onPress={del} accessibilityHint="Menghapus draf dan salinan fotonya dari Niragni" />
      </ScrollView>
    </Screen>
  );
}
