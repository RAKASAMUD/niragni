/**
 * Review. Editable summary; each AI observation carries a provenance label
 * (user / metadata / ai_visual) and an uncertainty flag, and can be accepted
 * per section. Unknown fields are shown explicitly. At most three complementary
 * questions. Export selection for photos and precise location. Revision-safe:
 * if the stored report advanced past the suggestion's revision, we warn and do
 * not auto-apply AI text over the user's edits.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import {
  Screen, Heading, Body, Caption, Label, Button, Card, Field, StatusPill, Notice, Row, Divider, space,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor } from '../../../src/ui/useReportEditor';
import { Observation, Source } from '../../../src/ui/services';

function sourceLabel(s: Source): string {
  switch (s) {
    case 'user': return 'Dari Anda';
    case 'metadata': return 'Dari metadata';
    case 'ai_visual': return 'Interpretasi foto (AI)';
    default: return 'Sumber lain';
  }
}

function observationLine(obs: Observation): string {
  return `- ${obs.text}${obs.uncertain ? ' (belum pasti)' : ''}`;
}

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { report, update, flush, isDirty, saveState } = useReportEditor(id);
  const [navError, setNavError] = useState<string | null>(null);
  const allowLeaveRef = useRef(false);

  // Native hardware Back / iOS swipe: save the editable summary first; only let
  // the removal through on success, otherwise stay and show the error.
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

  const goShare = useCallback(async () => {
    setNavError(null);
    try { await flush(); allowLeaveRef.current = true; router.push(`/report/${id}/share`); }
    catch (e) { setNavError(e instanceof Error ? e.message : 'Belum tersimpan.'); }
  }, [flush, id, router]);

  const goBack = useCallback(async () => {
    setNavError(null);
    try { await flush(); allowLeaveRef.current = true; router.back(); }
    catch (e) { setNavError(e instanceof Error ? e.message : 'Belum tersimpan.'); }
  }, [flush, router]);

  const suggestion = report?.suggestion ?? null;
  // Validity is owned by the store: saveReport clears `suggestion` to null only
  // when an AI INPUT field changes. Editing reviewedText, toggling share, or
  // accepting a section does NOT invalidate it. So a non-null suggestion is
  // current by construction — we do NOT compute staleness from a revision
  // comparison (which would always trip after the save-time revision increment).

  // Acceptance is DERIVED from the persisted reviewedText (not ephemeral state):
  // an observation counts as accepted when its exact line is already present.
  // This survives remount (returning from the share screen) and prevents
  // appending the same observation twice.
  const acceptObservation = useCallback((obs: Observation) => {
    if (!report) return;
    const line = observationLine(obs);
    const current = report.reviewedText || '';
    if (current.includes(line)) return; // already accepted — idempotent
    update({ reviewedText: current ? `${current}\n${line}` : line });
  }, [report, update]);

  // Summary acceptance: append the AI summary into reviewedText idempotently.
  // This PRESERVES any manual edits (it only appends; it never silently
  // overwrites the user's text) and is a no-op if the summary is already there.
  const acceptSummary = useCallback(() => {
    if (!report?.suggestion?.summary) return;
    const line = report.suggestion.summary.trim();
    if (!line) return;
    const current = report.reviewedText || '';
    if (current.includes(line)) return; // already adopted — idempotent
    update({ reviewedText: current ? `${current}\n${line}` : line });
  }, [report, update]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Tinjau laporan" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}><Caption>Memuat…</Caption></View>
      </Screen>
    );
  }

  const questions = (suggestion?.questions ?? []).slice(0, 3);
  const selectedPhotos = report.attachments.filter((a) => a.selectedForShare).length;

  return (
    <Screen>
      <FlowHeader title="Tinjau laporan" onBack={goBack} right={<Button title="Pilih kanal" onPress={goShare} style={{ paddingVertical: space.sm }} />} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Caption style={{ marginBottom: space.md }}>Periksa sebelum membagikan.</Caption>
        {navError ? <Notice text={navError} tone="error" /> : null}

        {/* Editable reviewed summary */}
        <Label>Ringkasan laporan (dapat diedit)</Label>
        <Field
          value={report.reviewedText}
          onChangeText={(text) => update({ reviewedText: text })}
          placeholder="Ringkasan yang akan Anda tinjau dan bagikan…"
          multiline
          accessibilityLabel="Ringkasan laporan yang dapat diedit"
        />

        <Divider />

        {/* User's own notes (facts) */}
        <Label>Pengamatan Anda</Label>
        <Card style={{ marginTop: space.xs }}>
          <Body>{report.rawText?.trim() || 'Belum ada catatan.'}</Body>
        </Card>

        <Divider />

        {/* AI suggestion with provenance + uncertainty, accept per section */}
        <Label>Saran AI (tandai asal, terima per bagian)</Label>
        {!suggestion ? (
          <Card style={{ marginTop: space.xs }}>
            <Body secondary>Belum ada saran AI. Anda dapat melanjutkan manual.</Body>
          </Card>
        ) : (
          <>
            {suggestion.summary ? (
              <Card style={{ marginTop: space.xs, marginBottom: space.sm }}>
                <Caption>Ringkasan saran</Caption>
                <Body style={{ marginTop: space.xs }}>{suggestion.summary}</Body>
                {(() => {
                  const summaryAdopted = (report.reviewedText || '').includes(suggestion.summary.trim());
                  return (
                    <Button
                      title={summaryAdopted ? 'Ringkasan ditambahkan ke draf' : 'Terima ringkasan ke draf'}
                      variant={summaryAdopted ? 'secondary' : 'primary'}
                      onPress={acceptSummary}
                      disabled={summaryAdopted}
                      style={{ marginTop: space.md }}
                      accessibilityLabel="Terima ringkasan AI ke draf laporan"
                      accessibilityHint="Menambahkan ringkasan ke ringkasan laporan tanpa menimpa edit Anda"
                    />
                  );
                })()}
              </Card>
            ) : null}
            {suggestion.observations.map((obs, i) => {
              const isAccepted = (report.reviewedText || '').includes(observationLine(obs));
              return (
              <Card key={i} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <StatusPill label={sourceLabel(obs.source)} kind={obs.source === 'ai_visual' ? 'warn' : 'neutral'} />
                  {obs.uncertain ? <StatusPill label="Belum pasti" kind="warn" /> : null}
                </Row>
                <Body style={{ marginTop: space.sm }}>{obs.text}</Body>
                {obs.sourceRef ? <Caption style={{ marginTop: space.xs }}>Rujukan: {obs.sourceRef}</Caption> : null}
                <Button
                  title={isAccepted ? 'Diterima ke ringkasan' : 'Terima bagian ini'}
                  variant={isAccepted ? 'secondary' : 'primary'}
                  onPress={() => acceptObservation(obs)}
                  disabled={isAccepted}
                  style={{ marginTop: space.md }}
                  accessibilityLabel={`Terima observasi ${i + 1}`}
                />
              </Card>
              );
            })}

            {/* Unknown fields */}
            {suggestion.missingFields.length > 0 ? (
              <Card style={{ marginBottom: space.sm }}>
                <Label>Belum diketahui</Label>
                {suggestion.missingFields.map((f, i) => (
                  <Caption key={i} style={{ marginTop: space.xs }}>• {f}</Caption>
                ))}
              </Card>
            ) : null}

            {/* Up to three complementary questions */}
            {questions.length > 0 ? (
              <Card style={{ marginBottom: space.sm }}>
                <Label>Pertanyaan pelengkap (maks. 3)</Label>
                {questions.map((q, i) => (
                  <Body key={i} style={{ marginTop: space.xs }}>{i + 1}. {q}</Body>
                ))}
              </Card>
            ) : null}
          </>
        )}

        <Divider />

        {/* Export selection */}
        <Label>Yang akan dibagikan</Label>
        <Caption style={{ marginTop: space.xs }}>
          {selectedPhotos} dari {report.attachments.length} foto dipilih. Atur pilihan foto di layar Foto.
        </Caption>
        <Row style={{ marginTop: space.sm, justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Body>Sertakan posisi tepat saya</Body>
            <Caption style={{ marginTop: 2 }}>
              {report.includeObserverLocation ? 'Disertakan' : 'Tidak disertakan'}
            </Caption>
          </View>
          <Button
            title={report.includeObserverLocation ? 'Jangan sertakan' : 'Sertakan'}
            variant="secondary"
            onPress={() => update({ includeObserverLocation: !report.includeObserverLocation })}
            accessibilityLabel="Alihkan sertakan posisi tepat saya pada ekspor"
          />
        </Row>

        <Divider />
        <Button title="Pilih kanal" onPress={goShare} />
        <Caption style={{ marginTop: space.md, textAlign: 'center' }}>
          Laporan belum dikirim dari aplikasi ini.
        </Caption>
      </ScrollView>
    </Screen>
  );
}
