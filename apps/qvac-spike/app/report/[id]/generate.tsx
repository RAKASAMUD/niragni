/**
 * AI drafting. Shows status, reassures that input is still saved, and offers
 * Cancel plus "Lanjut isi sendiri" (always available). No fabricated percentage.
 * After ~30s the manual option becomes more prominent.
 *
 * Lifecycle correctness (per coordinator review):
 * - The whole start (getReport + listModels + generateDraft) is wrapped so an
 *   error can never leave the screen stuck in "preparing".
 * - A run token guards against repeated/StrictMode double-invocation and marks
 *   the session abandoned; an abandoned async result never saves or navigates.
 *   The start effect has NO persistent "started" flag, so a StrictMode remount
 *   (cleanup then re-setup) restarts cleanly instead of sticking on "preparing".
 * - Unmount / Back / swipe cancels generation (not just the timer).
 * - Staleness is judged by comparing ALL AI input snapshot fields (text, time,
 *   timezone, incident text, observer GPS, and attachment id/hash/analysisUri),
 *   because the repository persists against CURRENT inputs at save time — a
 *   narrow three-field check would let a stale photo/GPS/timezone suggestion through.
 * - On failure with inputs safely saved, the real error text is shown so an
 *   invalid-AI-output case is distinguishable from a generic failure.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen, Heading, Body, Caption, Button, Notice, useTheme, space,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, ModelState, Report, Position, Attachment } from '../../../src/ui/services';

type Phase = 'preparing' | 'running' | 'failed' | 'notready';

function positionsEqual(a: Position | null, b: Position | null): boolean {
  if (a === null || b === null) return a === b;
  return a.latitude === b.latitude
    && a.longitude === b.longitude
    && a.accuracy === b.accuracy
    && a.timestamp === b.timestamp;
}

function attachmentsEqual(a: readonly Attachment[], b: readonly Attachment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // Compare the fields the AI actually consumes: identity, content hash, and
    // the analysis image path fed to the model.
    if (a[i].id !== b[i].id) return false;
    if (a[i].hash !== b[i].hash) return false;
    if (a[i].analysisUri !== b[i].analysisUri) return false;
  }
  return true;
}

/**
 * True only when EVERY AI-input snapshot field is unchanged. The three-field
 * check was too weak: the repository would happily save a suggestion against
 * mutated photos / GPS / timezone because it sees the current inputs at save
 * time. We compare all inputs the draft contributes to inference.
 */
function inputsEqual(a: Report, b: Report): boolean {
  return a.rawText === b.rawText
    && a.observationTime === b.observationTime
    && a.timezone === b.timezone
    && a.incidentLocationText === b.incidentLocationText
    && a.includeObserverLocation === b.includeObserverLocation
    && positionsEqual(a.observerLocation, b.observerLocation)
    && attachmentsEqual(a.attachments, b.attachments);
}

export default function Generate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Run token: increments on cancel/unmount; any async result from a superseded
  // run is abandoned (no save, no navigation).
  const runRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const start = useCallback(async () => {
    const myRun = ++runRef.current;
    setError(null);
    setPhase('preparing');
    setElapsed(0);
    try {
      const report = await services.getReport(id);
      if (myRun !== runRef.current) return;
      if (!report) { setError('Draf tidak ditemukan.'); setPhase('failed'); return; }

      const models: ModelState[] = await services.listModels();
      if (myRun !== runRef.current) return;
      const ready = models.find((m) => m.status === 'ready');
      if (!ready) { setPhase('notready'); return; }

      setPhase('running');
      setElapsed(0);
      stopTimer();
      timerRef.current = setInterval(() => {
        if (myRun === runRef.current) setElapsed((e) => e + 1);
      }, 1000);

      const result = await services.generateDraft(report, ready.candidateId);
      if (myRun !== runRef.current) return;

      // Re-read and only persist if the AI INPUT fields are unchanged since the
      // snapshot we generated from. Non-input edits (reviewedText/share) are fine.
      const current = await services.getReport(id);
      if (myRun !== runRef.current) return;
      if (!current) { setError('Draf tidak ditemukan.'); setPhase('failed'); return; }
      if (!inputsEqual(report, current)) {
        setError('Catatan, waktu, lokasi, atau foto berubah saat AI berjalan. Catatan dan foto Anda tetap tersimpan. Silakan susun ulang.');
        setPhase('failed');
        return;
      }

      await services.saveReport({
        ...current,
        suggestion: result.suggestion,
        suggestionRevision: result.inputRevision,
      });
      if (myRun !== runRef.current) return;
      router.replace(`/report/${id}/review`);
    } catch (e) {
      if (myRun !== runRef.current) return;
      // Keep the actual error text: distinguishes invalid AI output from a
      // generic failure. Input remains saved (we never mutated it here).
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Draf AI belum berhasil dibuat. Catatan dan foto Anda tetap tersimpan.\n\nRincian: ${msg}`);
      setPhase('failed');
    } finally {
      if (myRun === runRef.current) stopTimer();
    }
  }, [id, router]);

  useEffect(() => {
    // Per-mount: start a fresh generation run and, on cleanup (unmount / Back /
    // swipe / StrictMode remount), abandon THIS run and cancel generation.
    // No persistent "started" flag — a persistent flag would make a second
    // mount skip start() forever and get stuck on "preparing".
    void start();
    return () => {
      runRef.current += 1; // abandon this run's async result (no save/navigate)
      stopTimer();
      void services.cancelGeneration().catch(() => {});
    };
  }, [start]);

  const leaveCancelling = useCallback(async () => {
    runRef.current += 1; // abandon any in-flight result
    stopTimer();
    try { await services.cancelGeneration(); } catch { /* ignore */ }
  }, []);

  const cancel = useCallback(async () => {
    await leaveCancelling();
    router.back();
  }, [leaveCancelling, router]);

  const manual = useCallback(async () => {
    await leaveCancelling();
    router.replace(`/report/${id}/review`);
  }, [leaveCancelling, id, router]);

  const retry = useCallback(() => { void start(); }, [start]);

  const longRunning = elapsed >= 30;

  return (
    <Screen>
      <FlowHeader title="AI menyusun draf" onBack={cancel} backLabel="Batalkan dan kembali" />
      <View style={{ flex: 1, padding: space.lg }}>
        {phase === 'notready' ? (
          <>
            <Notice text="AI belum siap offline. Anda tetap bisa membuat dan menyimpan laporan." tone="warn" />
            <Button title="Lanjut isi sendiri" onPress={manual} />
          </>
        ) : phase === 'failed' ? (
          <>
            {error ? <Notice text={error} tone="error" /> : null}
            <Button title="Coba lagi" onPress={retry} />
            <View style={{ height: space.sm }} />
            <Button title="Lanjut isi sendiri" variant="quiet" onPress={manual} />
          </>
        ) : (
          <>
            <Heading>Menyusun draf…</Heading>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg }}>
              <ActivityIndicator color={t.actionBg} />
              <Body secondary>{phase === 'preparing' ? 'Menyiapkan…' : `Berjalan ${elapsed} detik`}</Body>
            </View>
            <Caption style={{ marginTop: space.md }}>
              Catatan dan foto Anda tetap tersimpan. Proses berjalan lokal.
            </Caption>
            {longRunning ? (
              <Notice text="Masih memproses. Anda dapat melanjutkan mengisi sendiri kapan saja." tone="warn" />
            ) : null}

            <View style={{ marginTop: space.xl }}>
              <Button title="Batalkan" variant="secondary" onPress={cancel} />
              <View style={{ height: space.sm }} />
              <Button
                title="Lanjut isi sendiri"
                variant={longRunning ? 'primary' : 'quiet'}
                onPress={manual}
                accessibilityHint="Melanjutkan tanpa menunggu AI"
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
