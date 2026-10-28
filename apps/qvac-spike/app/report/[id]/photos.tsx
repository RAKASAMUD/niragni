/**
 * Photos. Up to 3 photos, each <= 20 MB. Thumbnails with origin/time if known
 * and a "pilih untuk dibagikan" toggle. Add from camera/library, remove from
 * draft (does not delete the gallery original), retry a failed photo. addPhoto
 * and removePhoto persist in the store and return/refresh the report, so we
 * reload after each.
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Screen, Body, Caption, Label, Button, Card, StatusPill, Notice, Row, useTheme, space, radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, Report, Attachment } from '../../../src/ui/services';
import { formatBytes, formatShortDate, LIMITS } from '../../../src/ui/format';

export default function Photos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await services.getReport(id);
      setReport(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const count = report?.attachments?.length ?? 0;
  const atLimit = count >= LIMITS.maxPhotos;

  const add = useCallback(async (source: 'camera' | 'library') => {
    if (atLimit) {
      Alert.alert('Batas foto', `Maksimal ${LIMITS.maxPhotos} foto per draf.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Service copies the asset into app storage and persists the attachment.
      // A null result means the user cancelled the camera/picker — a quiet
      // no-op, NOT an error. A genuine cloud-only/unreadable photo throws and
      // is handled in catch below.
      const att = await services.addPhoto(id, source);
      if (att) {
        await load(); // reload per contract: caller reads getReport after addPhoto
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Friendly message for the cloud-only / unreadable-photo case; keep the
      // actual message for other failures so they stay diagnosable.
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

  const remove = useCallback((att: Attachment, index: number) => {
    Alert.alert(
      'Hapus foto',
      'Hapus foto ini dari draf? Foto asli di galeri tetap ada.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: async () => {
            try {
              const updated = await services.removePhoto(id, att.id);
              setReport(updated);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }, [id]);

  const toggleShare = useCallback(async (att: Attachment) => {
    if (!report) return;
    // Persist selectedForShare via saveReport with the current revision.
    const nextAttachments = report.attachments.map((a) =>
      a.id === att.id ? { ...a, selectedForShare: !a.selectedForShare } : a);
    try {
      const stored = await services.saveReport({ ...report, attachments: nextAttachments });
      setReport(stored);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [report]);

  return (
    <Screen>
      <FlowHeader title="Foto" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}>
        <Caption style={{ marginBottom: space.md }}>
          {count} dari {LIMITS.maxPhotos} foto · maksimal {formatBytes(LIMITS.maxPhotoBytes)} per foto
        </Caption>
        {error ? <Notice text={error} tone="error" /> : null}

        <Row style={{ marginBottom: space.lg }}>
          <Button title="Ambil foto" onPress={() => add('camera')} loading={busy} disabled={atLimit} style={{ flex: 1 }}
            accessibilityHint="Membuka kamera" />
          <Button title="Pilih dari galeri" variant="secondary" onPress={() => add('library')} loading={busy} disabled={atLimit} style={{ flex: 1 }}
            accessibilityHint="Membuka galeri" />
        </Row>

        {count === 0 ? (
          <Card><Label>Belum ada foto pada draf ini.</Label></Card>
        ) : (
          report!.attachments.map((att, i) => (
            <Card key={att.id} style={{ marginBottom: space.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Image
                  source={{ uri: att.uri }}
                  accessibilityLabel={`Foto ${i + 1} dari draf`}
                  style={{ width: 72, height: 72, borderRadius: radius.input, backgroundColor: t.border }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Body>Foto {i + 1}</Body>
                  <Caption style={{ marginTop: 2 }}>
                    {att.source === 'camera' ? 'Kamera' : 'Galeri'} · {formatBytes(att.bytes)}
                  </Caption>
                  <Caption style={{ marginTop: 2 }}>{att.width}×{att.height}</Caption>
                  <View style={{ marginTop: space.sm }}>
                    <StatusPill
                      label={att.selectedForShare ? 'Dipilih untuk dibagikan' : 'Tidak dibagikan'}
                      kind={att.selectedForShare ? 'positive' : 'neutral'}
                    />
                  </View>
                </View>
              </Row>
              <Row style={{ marginTop: space.md }}>
                <Button
                  title={att.selectedForShare ? 'Batalkan pilih' : 'Pilih untuk dibagikan'}
                  variant="secondary"
                  onPress={() => toggleShare(att)}
                  style={{ flex: 1 }}
                  accessibilityLabel={`${att.selectedForShare ? 'Batalkan pilih' : 'Pilih untuk dibagikan'} foto ${i + 1}`}
                />
                <Button
                  title="Hapus"
                  variant="destructive"
                  onPress={() => remove(att, i)}
                  style={{ flex: 1 }}
                  accessibilityLabel={`Hapus foto ${i + 1} dari draf`}
                />
              </Row>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
