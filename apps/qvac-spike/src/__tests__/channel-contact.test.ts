jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(undefined),
}));
import * as Linking from 'expo-linking';
import { openDialer } from '../core/channels';

beforeEach(() => jest.clearAllMocks());
it.each([
  ['damkar-pekanbaru-wa', 'https://wa.me/6285186070113'],
  ['damkarmat-jogjakota-wa', 'https://wa.me/628112828113'],
  ['damkar-pekanbaru-tel', 'tel:076122382'],
])('opens the contact action for %s without sending a report', async (id, url) => {
  await openDialer(id);
  expect(Linking.openURL).toHaveBeenCalledWith(url);
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
});
it('rejects a removed national contact before opening an external app', async () => {
  await expect(openDialer('kemenhut-posko-wa')).rejects.toThrow();
  expect(Linking.openURL).not.toHaveBeenCalled();
});
