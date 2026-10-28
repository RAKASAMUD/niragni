/**
 * Kanal bantuan — help channel directory. Shows number, coverage (cakupan),
 * channel kind, source and data age. Opens the dialer with the destination
 * visible; never auto-calls. Works offline from the stored list.
 */
import React, { useCallback, useState } from 'react';
import { View, FlatList, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Screen, Heading, Body, Caption, Label, Button, Card, StatusPill, Notice, Row, useTheme, space,
} from '../../src/ui/components';
import { services, Channel } from '../../src/ui/services';
import { formatShortDate } from '../../src/ui/format';

export default function Channels() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    try {
      setChannels(services.listChannels());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []));

  const openSource = useCallback((url: string) => { void Linking.openURL(url).catch(() => {}); }, []);

  const dial = useCallback(async (c: Channel) => {
    // Explicit user action only — services.openDialer must not place a call.
    try {
      await services.openDialer(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: Channel }) => {
    const kindLabel = item.kind === 'phone' ? 'Telepon' : item.kind === 'whatsapp' ? 'WhatsApp' : 'Email';
    const unconfirmed = item.availability === 'unconfirmed';
    return (
      <Card style={{ marginBottom: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ flex: 1, fontWeight: '700' }}>{item.label}</Body>
          <StatusPill label={item.availability === 'public' ? 'Publik' : 'Belum terkonfirmasi'} kind={unconfirmed ? 'warn' : 'positive'} />
        </Row>
        <Caption style={{ marginTop: space.xs }}>{kindLabel} · {item.destination}</Caption>
        <Caption style={{ marginTop: space.xs }}>Cakupan: {item.scope}</Caption>
        <Caption style={{ marginTop: space.xs }}>Sumber diperiksa: {formatShortDate(item.checkedAt)}</Caption>
        {unconfirmed ? (
          <Notice text="Ketersediaan layanan di wilayah ini belum terkonfirmasi." tone="warn" />
        ) : null}
        <Row style={{ marginTop: space.md }}>
          {item.kind === 'phone' ? (
            <Button
              title="Buka dialer"
              variant="destructive"
              onPress={() => dial(item)}
              accessibilityLabel={`Buka dialer ke ${item.label}, ${item.destination}`}
              accessibilityHint="Membuka aplikasi telepon; tidak menelepon otomatis"
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            title="Sumber & tanggal"
            variant="secondary"
            onPress={() => openSource(item.sourceUrl)}
            accessibilityLabel={`Buka sumber ${item.label}`}
            style={{ flex: 1 }}
          />
        </Row>
      </Card>
    );
  }, [dial, openSource]);

  return (
    <Screen>
      <FlatList
        data={channels}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xxl,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <Heading>Kanal bantuan</Heading>
            <Caption style={{ marginTop: space.xs }}>
              Nomor dan cakupan dari sumber publik. Membuka dialer tidak menelepon otomatis.
            </Caption>
            {error ? <Notice text={error} tone="error" /> : null}
          </View>
        }
        ListEmptyComponent={
          <Card><Label>Belum ada kanal tersimpan.</Label></Card>
        }
      />
    </Screen>
  );
}
