/**
 * Review screen aligned with approved Figma design.
 * Structure:
 * 1. Cyan card: Ringkasan (editable summary inside white input card).
 * 2. Peach card: Pengamatan Anda ("Dari Anda" pill + raw notes).
 * 3. Cyan card: Interpretasi foto ("AI · belum pasti" pill + AI observation + "Tambahkan ke ringkasan →").
 * 4. White card: Belum diketahui (questions/missing info).
 * 5. Action: "Pilih kanal" (black pill CTA).
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Notice,
  SafetyFooter,
  useTheme,
  space,
  radius,
} from '../../../src/ui/components';
import { FlowHeader } from '../../../src/ui/FlowHeader';
import { useReportEditor } from '../../../src/ui/useReportEditor';
import { Observation } from '../../../src/ui/services';

function observationLine(obs: Observation): string {
  return `- ${obs.text}${obs.uncertain ? ' (belum pasti)' : ''}`;
}

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTheme();
  const { report, update, flush, isDirty, saveState } = useReportEditor(id);
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

  const goShare = useCallback(async () => {
    setNavError(null);
    try {
      await flush();
      allowLeaveRef.current = true;
      router.push(`/report/${id}/share`);
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan.');
    }
  }, [flush, id, router]);

  const goBack = useCallback(async () => {
    setNavError(null);
    try {
      await flush();
      allowLeaveRef.current = true;
      router.back();
    } catch (e) {
      setNavError(e instanceof Error ? e.message : 'Belum tersimpan.');
    }
  }, [flush, router]);

  const suggestion = report?.suggestion ?? null;

  const acceptObservation = useCallback((obs: Observation) => {
    if (!report) return;
    const line = observationLine(obs);
    const current = report.reviewedText || '';
    if (current.includes(line)) return;
    update({ reviewedText: current ? `${current}\n${line}` : line });
  }, [report, update]);

  const acceptSummary = useCallback(() => {
    if (!report?.suggestion?.summary) return;
    const line = report.suggestion.summary.trim();
    if (!line) return;
    const current = report.reviewedText || '';
    if (current.includes(line)) return;
    update({ reviewedText: current ? `${current}\n${line}` : line });
  }, [report, update]);

  if (!report) {
    return (
      <Screen>
        <FlowHeader title="Tinjau laporan" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          <Text style={{ color: t.textSecondary }}>Memuat…</Text>
        </View>
      </Screen>
    );
  }

  const questions = (suggestion?.questions ?? []).slice(0, 3);
  const observations = suggestion?.observations ?? [];

  return (
    <Screen>
      <FlowHeader
        title="Tinjau laporan"
        onBack={goBack}
        helpActionLabel="Kanal bantuan"
        onHelp={() => router.push('/channels')}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {navError ? <Notice text={navError} tone="error" /> : null}

          {/* CARD 1: RINGKASAN (CYAN) */}
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
                Ringkasan
              </Text>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#465257' }}>
              Sunting sebelum membagikan
            </Text>

            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: '#DFDEE5',
                minHeight: 92,
              }}
            >
              <TextInput
                value={report.reviewedText}
                onChangeText={(text) => update({ reviewedText: text })}
                placeholder="Tulis ringkasan pengamatan Anda yang akan ditinjau dan dibagikan..."
                placeholderTextColor="#656575"
                multiline
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: '#11121A',
                  textAlignVertical: 'top',
                  minHeight: 70,
                }}
                accessibilityLabel="Sunting ringkasan sebelum membagikan"
              />
            </View>
          </View>

          {/* CARD 2: PENGAMATAN ANDA (PEACH) */}
          <View
            style={[
              {
                backgroundColor: t.peach,
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
                <Ionicons name="eye-outline" size={20} color="#11121A" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                Pengamatan Anda
              </Text>
            </View>

            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#FFFFFF',
                borderRadius: 15,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#11121A' }}>
                Dari Anda
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: '#11121A', lineHeight: 18 }}>
              {report.rawText?.trim() || 'Belum ada catatan pengamatan.'}
            </Text>
          </View>

          {/* CARD 3: INTERPRETASI FOTO / SARAN AI (CYAN) */}
          {suggestion ? (
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
                  <Ionicons name="camera-outline" size={20} color="#11121A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                  Interpretasi foto & AI
                </Text>
              </View>

              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 15,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#11121A' }}>
                  AI · belum pasti
                </Text>
              </View>

              {suggestion.summary ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#11121A', lineHeight: 18 }}>
                    {suggestion.summary}
                  </Text>
                  {!(report.reviewedText || '').includes(suggestion.summary.trim()) ? (
                    <Pressable
                      onPress={acceptSummary}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#11121A' }}>
                        Tambahkan ke ringkasan →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {observations.map((obs, idx) => {
                const line = observationLine(obs);
                const isAdopted = (report.reviewedText || '').includes(line);
                return (
                  <View key={idx} style={{ marginTop: 6, gap: 4 }}>
                    <Text style={{ fontSize: 13, color: '#11121A', lineHeight: 18 }}>
                      {obs.text} {obs.uncertain ? '(belum pasti)' : ''}
                    </Text>
                    {!isAdopted ? (
                      <Pressable onPress={() => acceptObservation(obs)}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#11121A' }}>
                          Tambahkan ke ringkasan →
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* CARD 4: BELUM DIKETAHUI (WHITE) */}
          {questions.length > 0 ? (
            <View
              style={[
                {
                  backgroundColor: '#FFFFFF',
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
                  <Ionicons name="help-circle-outline" size={20} color="#11121A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#11121A' }}>
                  Belum diketahui
                </Text>
              </View>

              {questions.map((q, idx) => (
                <View key={idx} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#11121A', lineHeight: 18 }}>
                    {q}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={{ fontSize: 12, color: '#656575', marginBottom: space.lg }}>
            Foto & posisi yang dibagikan dipilih pada tahap berikutnya.
          </Text>

          {/* ACTION BUTTON: PILIH KANAL */}
          <Pressable
            onPress={goShare}
            accessibilityRole="button"
            accessibilityLabel="Pilih kanal laporan"
            style={({ pressed }) => [
              {
                backgroundColor: '#11121A',
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.88 : 1,
              },
              t.cardShadow,
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
              Pilih kanal
            </Text>
          </Pressable>

          <SafetyFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
