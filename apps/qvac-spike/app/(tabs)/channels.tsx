/**
 * Channels directory tab aligned with approved Figma design.
 * Strict rules:
 * - Damkar incident channels only (no generic/national office contacts).
 * - Honest local coverage gap notice for unverified cities.
 * - Zero inference from observer GPS (user manually selects the incident region).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Linking,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  BrandHeader,
  StatusPill,
  Notice,
  useTheme,
  space,
  radius,
} from '../../src/ui/components';
import { services, Channel } from '../../src/ui/services';
import { formatDateOnly, formatIndonesianHeaderDate } from '../../src/ui/format';
import {
  filterChannelsByRegion,
  getAvailableRegions,
} from '../../src/core/channels';

export default function Channels() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setChannels(services.listChannels());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, [])
  );

  const openSource = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

  const dial = useCallback(async (c: Channel) => {
    try {
      await services.openDialer(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const availableCities = getAvailableRegions(channels);
  const activeRegion = searchQuery.trim() ? searchQuery.trim() : (selectedCity === 'semua' ? '' : selectedCity);
  const filterResult = filterChannelsByRegion(channels, activeRegion);

  const renderItem = useCallback(
    ({ item }: { item: Channel }) => {
      return (
        <View
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
                {item.label}
              </Text>
              <Text style={{ fontSize: 12, color: '#465257', marginTop: 2 }}>
                {item.destination} · {item.scope}
              </Text>
            </View>
            <StatusPill label="Damkar" kind="positive" />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {item.kind === 'phone' || item.kind === 'whatsapp' ? (
              <Pressable
                onPress={() => dial(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.kind === 'whatsapp' ? 'Buka WhatsApp' : 'Buka dialer'} ke ${item.label}`}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: '#11121A',
                    paddingVertical: 10,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.88 : 1,
                  },
                  t.cardShadow,
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                  {item.kind === 'whatsapp' ? 'Buka WhatsApp' : 'Buka dialer'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => openSource(item.sourceUrl)}
              accessibilityRole="button"
              accessibilityLabel={`Buka sumber ${item.label}`}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#DFDEE5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#656575', fontSize: 11, fontWeight: '600' }}>
                Sumber · {formatDateOnly(item.checkedAt)}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [dial, openSource, t]
  );

  return (
    <Screen>
      <FlatList
        data={filterResult.channels}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 96,
        }}
        ListHeaderComponent={
          <View>
            <BrandHeader subtitle={formatIndonesianHeaderDate()} />

            {/* Cyan Card: Temukan kanal setempat */}
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
                <View
                  style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="location-outline" size={20} color="#11121A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#11121A' }}>
                  Temukan kanal setempat
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '600', color: '#465257' }}>
                Wilayah kejadian
              </Text>

              {/* Input for custom city/regency */}
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
                }}
              >
                <Ionicons name="search-outline" size={18} color="#656575" />
                <TextInput
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
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
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#656575" />
                  </Pressable>
                ) : null}
              </View>

              <Text style={{ fontSize: 11, color: '#465257' }}>
                Hanya kontak Damkar lokal terverifikasi. Tidak ada substitusi nomor kantor pusat.
              </Text>
            </View>

            {/* City filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: space.md }}
            >
              <Pressable
                onPress={() => {
                  setSelectedCity('semua');
                  setSearchQuery('');
                }}
                style={{
                  backgroundColor: selectedCity === 'semua' && !searchQuery ? '#11121A' : '#FFFFFF',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: selectedCity === 'semua' && !searchQuery ? '#11121A' : '#DFDEE5',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selectedCity === 'semua' && !searchQuery ? '#FFFFFF' : '#11121A',
                  }}
                >
                  Semua
                </Text>
              </Pressable>
              {availableCities.map((city) => {
                const isSelected = selectedCity === city && !searchQuery;
                return (
                  <Pressable
                    key={city}
                    onPress={() => {
                      setSelectedCity(city);
                      setSearchQuery('');
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

            {/* Honest gap / coverage notice */}
            {filterResult.coverageNotice ? (
              <View style={{ marginBottom: space.md }}>
                <Notice
                  text={filterResult.coverageNotice}
                  tone={filterResult.channels.length === 0 ? 'warn' : 'info'}
                />
              </View>
            ) : null}

            {error ? <Notice text={error} tone="error" /> : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              {
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: space.xl,
                alignItems: 'center',
                gap: 8,
              },
              t.cardShadow,
            ]}
          >
            <Ionicons name="alert-circle-outline" size={32} color="#B45309" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#11121A' }}>
              Tidak ada saluran Damkar lokal
            </Text>
            <Text style={{ fontSize: 13, color: '#656575', textAlign: 'center' }}>
              Wilayah ini belum memiliki nomor Damkar terverifikasi dalam direktori saat ini.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
