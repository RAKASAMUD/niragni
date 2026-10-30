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
 * - Unmount / Back / swipe cancels generation (not just the timer).
 * - Staleness is judged by comparing ALL AI input snapshot fields.
 * - On failure with inputs safely saved, the real error text is shown.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Notice,
  useTheme,
  space,
  radius,
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
    if (a[i].id !== b[i].id) return false;
    if (a[i].hash !== b[i].hash) return false;
    if (a[i].analysisUri !== b[i].analysisUri) return false;
  }
  return true;
}

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

  const runRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback(async () => {
    const myRun = ++runRef.current;
    setError(null);
    setPhase('preparing');
    setElapsed(0);
    try {
      const report = await services.getReport(id);
      if (myRun !== runRef.current) return;
      if (!report) {
        setError('Draf tidak ditemukan.');
        setPhase('failed');
        return;
      }

      const models: ModelState[] = await services.listModels();
      if (myRun !== runRef.current) return;
      const ready = models.find((m) => m.status === 'ready');
      if (!ready) {
        setPhase('notready');
        return;
      }

      setPhase('running');
      setElapsed(0);
      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);

      const aiResult = await services.generateDraft(report, ready.candidateId);
      if (myRun !== runRef.current) return;

      const latest = await services.getReport(id);
      if (myRun !== runRef.current) return;
      if (!latest) {
        router.replace(`/report/${id}/review`);
        return;
      }

      if (!inputsEqual(latest, report)) {
        router.replace(`/report/${id}/review`);
        return;
      }

      const mergedReviewed =
        latest.reviewedText?.trim()
          ? latest.reviewedText
          : (aiResult.suggestion.summary?.trim() || latest.rawText);

      await services.saveReport({
        ...latest,
        suggestion: aiResult.suggestion,
        suggestionRevision: latest.revision,
        reviewedText: mergedReviewed,
      });

      if (myRun !== runRef.current) return;
      router.replace(`/report/${id}/review`);
    } catch (e) {
      if (myRun !== runRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Draf AI belum berhasil dibuat. Catatan dan foto Anda tetap tersimpan.\n\nRincian: ${msg}`);
      setPhase('failed');
    } finally {
      if (myRun === runRef.current) stopTimer();
    }
  }, [id, router]);

  useEffect(() => {
    void start();
    return () => {
      runRef.current += 1;
      stopTimer();
      void services.cancelGeneration().catch(() => {});
    };
  }, [start]);

  const leaveCancelling = useCallback(async () => {
    runRef.current += 1;
    stopTimer();
    try {
      await services.cancelGeneration();
    } catch {
      /* ignore */
    }
  }, []);

  const cancel = useCallback(async () => {
    await leaveCancelling();
    router.back();
  }, [leaveCancelling, router]);

  const manual = useCallback(async () => {
    await leaveCancelling();
    router.replace(`/report/${id}/review`);
  }, [leaveCancelling, id, router]);

  const retry = useCallback(() => {
    void start();
  }, [start]);

  const longRunning = elapsed >= 30;

  return (
    <Screen>
      <FlowHeader title="AI menyusun draf" onBack={cancel} backLabel="Batalkan dan kembali" />
      <View style={{ flex: 1, padding: space.lg }}>
        {phase === 'notready' ? (
          <View
            style={[
              {
                backgroundColor: t.peach,
                borderRadius: 24,
                padding: 20,
                gap: 14,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="cloud-offline-outline" size={24} color="#B45309" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#11121A' }}>
                AI Belum Siap Offline
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#465257', lineHeight: 18 }}>
              Model AI lokal belum diunduh atau siap di perangkat. Anda tetap bisa mengisi dan menyimpan laporan secara manual.
            </Text>
            <Pressable
              onPress={manual}
              style={{
                backgroundColor: '#11121A',
                borderRadius: 20,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                Lanjut isi sendiri
              </Text>
            </Pressable>
          </View>
        ) : phase === 'failed' ? (
          <View
            style={[
              {
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 20,
                gap: 12,
              },
              t.cardShadow,
            ]}
          >
            {error ? <Notice text={error} tone="error" /> : null}
            <Pressable
              onPress={retry}
              style={{
                backgroundColor: '#11121A',
                borderRadius: 20,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                Coba lagi
              </Text>
            </Pressable>
            <Pressable
              onPress={manual}
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#656575', fontSize: 13, fontWeight: '600' }}>
                Lanjut isi sendiri →
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              {
                backgroundColor: t.cyan,
                borderRadius: 24,
                padding: 20,
                gap: 14,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#11121A' }}>
              Menyusun draf…
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#11121A" />
              <Text style={{ fontSize: 14, color: '#11121A', fontWeight: '600' }}>
                {phase === 'preparing' ? 'Menyiapkan…' : `Berjalan ${elapsed} detik`}
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: '#465257', lineHeight: 17 }}>
              Catatan dan foto Anda tetap tersimpan. Proses berjalan lokal di perangkat tanpa koneksi internet.
            </Text>

            {longRunning ? (
              <Notice
                text="Masih memproses. Anda dapat melanjutkan mengisi sendiri kapan saja."
                tone="warn"
              />
            ) : null}

            <View style={{ gap: 8, marginTop: 6 }}>
              <Pressable
                onPress={manual}
                style={{
                  backgroundColor: '#11121A',
                  borderRadius: 20,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  Lanjut isi sendiri
                </Text>
              </Pressable>

              <Pressable
                onPress={cancel}
                style={{
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#656575', fontSize: 13, fontWeight: '600' }}>
                  Batalkan
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
