/**
 * Location & time. Two distinct groups: "Posisi Anda" (observer) and
 * "Perkiraan lokasi kejadian" (incident) — never auto-filling the incident
 * coordinate from observer GPS. Observer GPS is optional and shows accuracy
 * "± N m" and timestamp only when known; manual entry always available.
 * Observation time + timezone are editable here. Autosaves via the editor.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import {
  Screen, Body, Caption, Label, Button, Card, Field, Notice, Row, Divider, space,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor } from '../../../src/ui/useReportEditor';
import { services } from '../../../src/ui/services';
import { formatAccuracy, formatTimeWithZone } from '../../../src/ui/format';

export default function LocationScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { report, update, flush, isDirty, saveState } = useReportEditor(id);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const allowLeaveRef = useRef(false);

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

  const goBack = useCallback(async () => {
    setNavError(null);
    try {
      await flush();
      allowLeaveRef.current = true;
      router.back();
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan. Ruang perangkat mungkin tidak cukup.');
    }
  }, [flush, router]);

  const useGps = useCallback(async () => {
    setGpsBusy(true);
    setGpsError(null);
    try {
      const pos = await services.getObserverLocation();
      update({ observerLocation: pos, includeObserverLocation: true });
    } catch {
      setGpsError('Anda bisa menulis lokasi atau patokan secara manual.');
    } finally {
      setGpsBusy(false);
    }
  }, [update]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Lokasi & waktu" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}><Caption>Memuat…</Caption></View>
      </Screen>
    );
  }

  const accuracy = report.observerLocation ? formatAccuracy(report.observerLocation.accuracy) : null;

  return (
    <Screen>
      <FlowHeader title="Lokasi & waktu" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        {navError ? <Notice text={navError} tone="error" /> : null}
        {/* Observation time */}
        <Label>Waktu pengamatan</Label>
        <Caption style={{ marginTop: 2, marginBottom: space.sm }}>
          {formatTimeWithZone(report.observationTime, report.timezone)}
        </Caption>
        <Field
          label="Waktu (ISO atau teks)"
          value={report.observationTime}
          onChangeText={(text) => update({ observationTime: text })}
          placeholder="2026-10-28T14:15:00+07:00"
          autoCapitalize="none"
          accessibilityLabel="Waktu pengamatan"
          autoFocus={focus === 'time'}
        />
        <Field
          label="Zona waktu"
          value={report.timezone}
          onChangeText={(text) => update({ timezone: text })}
          placeholder="Asia/Jakarta (WIB), Asia/Makassar (WITA), Asia/Jayapura (WIT)"
          autoCapitalize="none"
          helpText="Zona waktu disimpan eksplisit; tidak diasumsikan WIB untuk seluruh Indonesia."
        />

        <Divider />

        {/* Observer position */}
        <Label>Posisi Anda (pelapor)</Label>
        <Caption style={{ marginTop: 2, marginBottom: space.sm }}>
          Posisi Anda berbeda dari lokasi kejadian. Opsional.
        </Caption>
        {gpsError ? <Notice text={gpsError} tone="warn" /> : null}
        {report.includeObserverLocation && report.observerLocation ? (
          <Card style={{ marginBottom: space.sm }}>
            <Body>Lat {report.observerLocation.latitude.toFixed(5)}, Lon {report.observerLocation.longitude.toFixed(5)}</Body>
            <Caption style={{ marginTop: 2 }}>
              {accuracy ? `Akurasi ${accuracy}` : 'Akurasi tidak diketahui'} · {formatTimeWithZone(report.observerLocation.timestamp, undefined)}
            </Caption>
          </Card>
        ) : (
          <Caption style={{ marginBottom: space.sm }}>Belum diisi.</Caption>
        )}
        <Row>
          <Button title="Gunakan GPS" variant="secondary" onPress={useGps} loading={gpsBusy} style={{ flex: 1 }}
            accessibilityHint="Mengisi posisi pelapor dari GPS; opsional" />
          {report.includeObserverLocation ? (
            <Button title="Hapus posisi" variant="quiet" onPress={() => update({ includeObserverLocation: false, observerLocation: null })} style={{ flex: 1 }} />
          ) : null}
        </Row>

        <Divider />

        {/* Incident location (manual, never from observer GPS) */}
        <Label>Perkiraan lokasi kejadian</Label>
        <Caption style={{ marginTop: 2, marginBottom: space.sm }}>
          Tulis arah/jarak/patokan. Tidak diisi otomatis dari GPS Anda.
        </Caption>
        <Field
          value={report.incidentLocationText}
          onChangeText={(text) => update({ incidentLocationText: text })}
          placeholder="Perkiraan 3 km arah barat laut dari desa, belum ada koordinat"
          multiline
          accessibilityLabel="Perkiraan lokasi kejadian"
        />
      </ScrollView>
    </Screen>
  );
}
