/**
 * Create/edit form. "Apa yang Anda lihat?" notes, photos entry, observation
 * time, observer position and incident location entry points, then two equal
 * CTAs: "Susun dengan AI" and "Lanjut tanpa AI". Autosave is serialized and
 * the save state is explicit. Back and any navigation to photo/AI await the
 * in-flight save first; if the save fails we STAY on the form and show an
 * error (no silent loss, no proceeding on an unsaved report). Native hardware
 * Back / swipe is intercepted with usePreventRemove so it obeys the same rule.
 * The model-not-ready state never blocks the manual form.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import {
  Screen, Caption, Label, Button, Field, StatusPill, Notice, Row, Divider, useTheme, space,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor, SaveState } from '../../../src/ui/useReportEditor';
import { services, ModelState } from '../../../src/ui/services';
import { formatTimeWithZone, formatAccuracy, LIMITS } from '../../../src/ui/format';

function saveLabel(s: SaveState): { label: string; kind: 'neutral' | 'busy' | 'positive' | 'error' } {
  switch (s) {
    case 'saving': return { label: 'Menyimpan…', kind: 'busy' };
    case 'saved': return { label: 'Tersimpan di perangkat', kind: 'positive' };
    case 'failed': return { label: 'Belum tersimpan', kind: 'error' };
    case 'editing': return { label: 'Perubahan belum tersimpan', kind: 'neutral' };
    default: return { label: 'Draf', kind: 'neutral' };
  }
}

export default function EditReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTheme();
  const editor = useReportEditor(id);
  const { report, saveState, errorMessage, isDirty, update, flush } = editor;
  const [models, setModels] = useState<ModelState[]>([]);
  const [navError, setNavError] = useState<string | null>(null);
  // Set true only once a flush has succeeded and we intend to leave, so the
  // native remove guard lets the navigation through.
  const allowLeaveRef = useRef(false);

  useFocusEffect(useCallback(() => {
    void services.listModels().then(setModels).catch(() => {});
    // reload is a no-op when there are unsaved/pending edits (guarded in hook).
    void editor.reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const anyReady = models.some((m) => m.status === 'ready');
  const sl = saveLabel(saveState);

  // Intercept native hardware Back / iOS swipe: save first; only allow the
  // removal if the save succeeded. On failure, stay and show the error.
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

  // Save, then run an action; on failure stay put and surface the error.
  const saveThen = useCallback(async (action: () => void) => {
    setNavError(null);
    try {
      await flush();
      action();
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan. Ruang perangkat mungkin tidak cukup.');
    }
  }, [flush]);

  const goBack = useCallback(() => saveThen(() => { allowLeaveRef.current = true; router.back(); }), [saveThen, router]);
  const goPhotos = useCallback(() => saveThen(() => router.push(`/report/${id}/photos`)), [saveThen, id, router]);
  const goLocation = useCallback(() => saveThen(() => router.push(`/report/${id}/location`)), [saveThen, id, router]);
  const goTime = useCallback(() => saveThen(() => router.push(`/report/${id}/location?focus=time`)), [saveThen, id, router]);
  const runAI = useCallback(() => saveThen(() => router.push(`/report/${id}/generate`)), [saveThen, id, router]);
  const continueManual = useCallback(() => saveThen(() => router.push(`/report/${id}/review`)), [saveThen, id, router]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Buat laporan" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          {errorMessage ? <Notice text={errorMessage} tone="error" /> : <Caption>Memuat draf…</Caption>}
        </View>
      </Screen>
    );
  }

  const photoCount = report.attachments?.length ?? 0;
  const accuracy = report.observerLocation ? formatAccuracy(report.observerLocation.accuracy) : null;

  return (
    <Screen>
      <FlowHeader
        title="Buat laporan"
        onBack={goBack}
        right={<StatusPill label={sl.label} kind={sl.kind} />}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          {saveState === 'failed' ? (
            <Notice text="Belum tersimpan. Ruang perangkat mungkin tidak cukup." tone="error" />
          ) : null}
          {navError ? <Notice text={navError} tone="error" /> : null}
          {!anyReady ? (
            <Notice text="AI belum siap offline. Anda tetap bisa membuat dan menyimpan laporan." />
          ) : null}

          <Label style={{ marginBottom: space.xs }}>Apa yang Anda lihat?</Label>
          <Field
            value={report.rawText}
            onChangeText={(text) => update({ rawText: text.slice(0, LIMITS.maxNotesChars) })}
            placeholder="Asap terlihat dari arah ..."
            multiline
            maxLength={LIMITS.maxNotesChars}
            accessibilityLabel="Catatan pengamatan"
          />

          <Divider />

          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Foto (opsional)</Label>
              <Caption style={{ marginTop: 2 }}>{photoCount} dari {LIMITS.maxPhotos} foto</Caption>
            </View>
            <Button title="Tambah / kelola foto" variant="secondary" onPress={goPhotos}
              accessibilityHint="Membuka kelola foto; menyimpan draf lebih dulu" />
          </Row>

          <Divider />

          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Waktu pengamatan</Label>
              <Caption style={{ marginTop: 2 }}>{formatTimeWithZone(report.observationTime, report.timezone)}</Caption>
            </View>
            <Button title="Ubah" variant="secondary" onPress={goTime} accessibilityLabel="Ubah waktu pengamatan" />
          </Row>

          <View style={{ height: space.md }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Posisi Anda</Label>
              <Caption style={{ marginTop: 2 }}>
                {report.includeObserverLocation && report.observerLocation
                  ? `Terisi${accuracy ? ` · ${accuracy}` : ''}`
                  : 'Belum diisi'}
              </Caption>
            </View>
            <Button title="Isi" variant="secondary" onPress={goLocation} accessibilityLabel="Isi posisi pelapor" />
          </Row>

          <View style={{ height: space.md }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Perkiraan lokasi kejadian</Label>
              <Caption style={{ marginTop: 2 }}>{report.incidentLocationText?.trim() || 'Belum diisi'}</Caption>
            </View>
            <Button title="Isi" variant="secondary" onPress={goLocation} accessibilityLabel="Isi perkiraan lokasi kejadian" />
          </Row>

          <Divider />

          <Button title="Susun dengan AI" onPress={runAI}
            accessibilityHint="Menyimpan draf lalu menjalankan AI lokal" />
          <View style={{ height: space.sm }} />
          <Button title="Lanjut tanpa AI" variant="quiet" onPress={continueManual}
            accessibilityHint="Melanjutkan ke tinjau tanpa AI" />
          <Caption style={{ marginTop: space.md, textAlign: 'center' }}>
            Laporan belum dikirim dari aplikasi ini.
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
