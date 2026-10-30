/**
 * Share screen aligned with approved Figma design.
 * Strict rules:
 * 1. MANDATORY: Selfie Wajib Sebelum Berbagi. "Buka pilihan berbagi" is blocked if selfie is missing.
 * 2. "Salin teks laporan" is completely removed to prevent selfie bypass.
 * 3. Channels list: DAMKAR ONLY. Requires explicit incident city choice to display numbers.
 *    No default "semua" — empty selection shows 0 rows with guidance notice.
 *    Manual city input supported alongside chips so unverified cities show honest gap notice.
 * 4. Shared busy mutex prevents parallel OS share / camera launches.
 * 5. Honest labeling throughout: "Upaya berbagi dicatat / dibatalkan", "disimpan lokal".
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  Linking,
  Pressable,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  StatusPill,
  Notice,
  SafetyFooter,
  useTheme,
  space,
  radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { services, Report, Channel, ExportPreview, ShareStage } from '../../../src/ui/services';
import { formatDateOnly, formatTimeWithZone } from '../../../src/ui/format';
import {
  filterChannelsByRegion,
  getAvailableRegions,
} from '../../../src/core/channels';

export default function Share() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [searchCity, setSearchCity] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [shareStage, setShareStage] = useState<ShareStage | null>(null);
  const [busy, setBusy] = useState(false);

  const isMountedRef = useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await services.getReport(id);
      if (!isMountedRef.current) return;
      setReport(r);
      setChannels(services.listChannels());
      if (r) {
        const p = await services.previewExport(r);
        if (!isMountedRef.current) return;
        setPreview(p);
      }
      setError(null);
    } catch (e) {
      if (!isMountedRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  // Reload whenever the screen regains focus (e.g. returning from taking a
  // selfie or from the channels help screen). Reuses the same load() used on
  // mount and after capturing a selfie, instead of duplicating the fetch logic.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const hasSelfie = !!report?.senderSelfie;

  // Shared in-flight synchronous mutex + visual busy state
  const share = useCallback(async (channelId?: string) => {
    if (busyRef.current) return;
    if (!report) return;
    if (!hasSelfie) {
      setError('Wajib mengambil foto selfie pengirim sebelum berbagi.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setShareStage('validating');
    try {
      await services.shareReport(report, channelId, setShareStage);
      const latest = await services.getReport(id);
      if (latest) {
        setReport(latest);
        setPreview(await services.previewExport(latest));
        const lastAttempt = latest.shareAttempts?.[0];
        if (lastAttempt?.event === 'cancelled') {
          setNotice('Upaya berbagi dibatalkan.');
        } else {
          setNotice('Pilihan berbagi telah dibuka. Niragni belum mengetahui apakah laporan diterima.');
        }
      } else {
        setNotice('Pilihan berbagi telah dibuka. Niragni belum mengetahui apakah laporan diterima.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel|batal/i.test(msg)) {
        setNotice('Upaya berbagi dibatalkan.');
      } else {
        setError(msg);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setShareStage(null);
    }
  }, [report, hasSelfie, id]);

  const dial = useCallback(async (c: Channel) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await services.openDialer(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const openSource = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

  const captureSelfieNow = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await services.captureSenderSelfie(id);
      if (result) {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [id, load]);

  const availableCities = getAvailableRegions(channels);
  const activeCity = searchCity.trim() ? searchCity.trim() : selectedCity.trim();
  const filterResult = activeCity
    ? filterChannelsByRegion(channels, activeCity)
    : { channels: [], coverageNotice: 'Pilih kota/kabupaten kejadian atau ketik nama wilayah untuk menampilkan saluran Damkar setempat.' };

  return (
    <Screen>
      <FlowHeader
        title="Pilih kanal"
        onBack={() => router.back()}
        helpActionLabel="Kanal bantuan"
        onHelp={() => router.push('/channels')}
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* CARD 1: PRATINJAU LAPORAN (CYAN) */}
        <View
          style={[
            {
              backgroundColor: t.cyan,
              borderRadius: 24,
              padding: 18,
              marginBottom: space.lg,
              gap: 10,
            },
            t.cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text-outline" size={20} color="#11121A" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
              Pratinjau laporan
            </Text>
          </View>

          <Text style={{ fontSize: 14, color: '#11121A', lineHeight: 20 }}>
            {preview?.text?.trim() || report?.reviewedText?.trim() || report?.rawText?.trim() || 'Belum ada isi laporan.'}
          </Text>

          <View style={{ gap: 2, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: '#465257' }}>
              Waktu: {formatTimeWithZone(report?.observationTime, report?.timezone)}
            </Text>
            <Text style={{ fontSize: 12, color: '#465257' }}>
              Lokasi kejadian: {report?.incidentLocationText?.trim() || 'Belum diisi'}
            </Text>
          </View>
        </View>

        {/* CARD 2: YANG DIBAGIKAN (CYAN) */}
        <View
          style={[
            {
              backgroundColor: t.cyan,
              borderRadius: 24,
              padding: 18,
              marginBottom: space.lg,
              gap: 10,
            },
            t.cardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="share-outline" size={20} color="#11121A" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
              Yang dibagikan
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            {/* Foto Kejadian */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#11121A' }}>
              {preview?.photoUris?.length
                ? `✓ ${preview.photoUris.length} foto kejadian terlampir`
                : '○ Tidak ada foto kejadian'}
            </Text>

            {/* Posisi Anda */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#11121A' }}>
              {report?.includeObserverLocation && report?.observerLocation
                ? '✓ Posisi tepat saya disertakan'
                : '○ Posisi tepat saya tidak disertakan'}
            </Text>

            {/* Selfie status */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: hasSelfie ? '#1B5E20' : '#B45309',
              }}
            >
              {hasSelfie
                ? '✓ Foto pengirim (selfie) disimpan lokal'
                : '✗ Belum ada foto pengirim (wajib sebelum berbagi)'}
            </Text>
          </View>

          {preview?.photoUris?.length ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {preview.photoUris.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#E0E0E0' }}
                  resizeMode="cover"
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* SELFIE GUARD CARD (PEACH) IF MISSING */}
        {!hasSelfie ? (
          <View
            style={[
              {
                backgroundColor: t.peach,
                borderRadius: 24,
                padding: 18,
                marginBottom: space.lg,
                gap: 12,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="alert-circle" size={24} color="#B45309" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Wajib Selfie Sebelum Berbagi
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: '#465257', lineHeight: 17 }}>
              Pengiriman laporan mewajibkan foto pengirim dengan kamera depan. Draf tetap bisa disimpan lokal, namun pilihan berbagi baru dapat dibuka setelah foto pengirim terisi.
            </Text>

            <Pressable
              onPress={captureSelfieNow}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Ambil selfie pengirim sekarang"
              style={({ pressed }) => [
                {
                  backgroundColor: busy ? 'rgba(0,0,0,0.3)' : '#11121A',
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: pressed ? 0.88 : 1,
                },
                t.cardShadow,
              ]}
            >
              <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                {busy ? 'Membuka kamera…' : 'Ambil selfie pengirim sekarang'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Feedback stays beside the action, including failures below the fold. */}
        {shareStage ? <Notice tone="info" text={{
          validating: 'Ketukan diterima. Memeriksa laporan dan selfie tersimpan…',
          sanitizing: 'Menyiapkan foto tanpa metadata lokasi…',
          copying: 'Menyalin lampiran ke cache berbagi…',
          opening: 'Membuka pilihan berbagi sistem. Selesaikan atau batalkan pilihan tersebut sebelum mencoba lagi.',
          recording: 'Mencatat upaya berbagi di perangkat…',
        }[shareStage]} /> : null}
        {error ? <Notice text={error} tone="error" /> : null}
        {notice ? <Notice text={notice} tone="info" /> : null}
        {/* PRIMARY SHARE ACTION (BLACK PILL) */}
        <Pressable
          onPress={() => share()}
          disabled={!hasSelfie || busy}
          accessibilityRole="button"
          accessibilityLabel="Buka pilihan berbagi"
          style={({ pressed }) => [
            {
              backgroundColor: hasSelfie && !busy ? '#11121A' : 'rgba(0,0,0,0.2)',
              height: 50,
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.xl,
              opacity: pressed && hasSelfie && !busy ? 0.88 : 1,
            },
            t.cardShadow,
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
            {!hasSelfie ? 'Wajib selfie sebelum berbagi' : busy ? 'Membuka berbagi…' : 'Buka pilihan berbagi'}
          </Text>
        </Pressable>

        {/* SECTION: DIREKTORI DAMKAR SETEMPAT */}
        <View style={{ marginBottom: space.sm }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#11121A', marginBottom: 4 }}>
            Kanal Damkar Terverifikasi
          </Text>
          <Text style={{ fontSize: 12, color: '#656575' }}>
            Hanya saluran resmi pemadam kebakaran per kota/kabupaten kejadian.
          </Text>
        </View>

        {/* Manual search input for city */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: '#DFDEE5',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: space.sm,
          }}
        >
          <Ionicons name="search-outline" size={18} color="#656575" />
          <TextInput
            value={searchCity}
            onChangeText={(text) => {
              setSearchCity(text);
              if (text.trim()) setSelectedCity('');
            }}
            placeholder="Ketik kota/kabupaten kejadian..."
            placeholderTextColor="#656575"
            style={{
              flex: 1,
              fontSize: 13,
              color: '#11121A',
              padding: 0,
            }}
          />
          {searchCity ? (
            <Pressable onPress={() => setSearchCity('')}>
              <Ionicons name="close-circle" size={16} color="#656575" />
            </Pressable>
          ) : null}
        </View>

        {/* Region filter chips (explicit choice) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: space.xs, marginBottom: space.md }}
        >
          {availableCities.map((city) => {
            const isSelected = selectedCity === city && !searchCity;
            return (
              <Pressable
                key={city}
                onPress={() => {
                  if (isSelected) {
                    setSelectedCity('');
                  } else {
                    setSelectedCity(city);
                    setSearchCity('');
                  }
                }}
                style={{
                  backgroundColor: isSelected ? '#11121A' : '#FFFFFF',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isSelected ? '#11121A' : '#DFDEE5',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isSelected ? '#FFFFFF' : '#11121A',
                  }}
                >
                  {city}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Coverage notice or Gap notice */}
        {filterResult.coverageNotice ? (
          <View style={{ marginBottom: space.md }}>
            <Notice
              text={filterResult.coverageNotice}
              tone={filterResult.channels.length === 0 ? 'info' : 'info'}
            />
          </View>
        ) : null}

        {/* Channels list: only rendered when explicit city matches */}
        {filterResult.channels.map((c) => (
          <View
            key={c.id}
            style={[
              {
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 16,
                marginBottom: space.md,
                gap: 10,
              },
              t.cardShadow,
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#11121A' }}>
                  {c.label}
                </Text>
                <Text style={{ fontSize: 12, color: '#465257', marginTop: 2 }}>
                  {c.destination} · {c.scope}
                </Text>
              </View>
              <StatusPill label="Damkar" kind="positive" />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {c.kind === 'phone' || c.kind === 'whatsapp' ? (
                <Pressable
                  onPress={() => dial(c)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.kind === 'whatsapp' ? 'Buka WhatsApp' : 'Buka dialer'} ke ${c.label}`}
                  style={{
                    flex: 1,
                    backgroundColor: busy ? 'rgba(0,0,0,0.3)' : '#11121A',
                    paddingVertical: 10,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    {c.kind === 'whatsapp' ? 'Buka WhatsApp' : 'Buka dialer'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => share(c.id)}
                  disabled={!hasSelfie || busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Bagikan ke ${c.label}`}
                  style={{
                    flex: 1,
                    backgroundColor: hasSelfie && !busy ? '#11121A' : 'rgba(0,0,0,0.2)',
                    paddingVertical: 10,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    {hasSelfie ? 'Bagikan ke kanal' : 'Wajib selfie'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => openSource(c.sourceUrl)}
                accessibilityRole="button"
                accessibilityLabel={`Buka sumber ${c.label}`}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#DFDEE5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#656575', fontSize: 11, fontWeight: '600' }}>
                  Sumber · {formatDateOnly(c.checkedAt)}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <SafetyFooter text="Membuka pilihan berbagi bukan bukti laporan diterima. Aplikasi tidak mengirim data otomatis ke server manapun." />
      </ScrollView>
    </Screen>
  );
}
