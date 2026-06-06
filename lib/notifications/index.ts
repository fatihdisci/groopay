// TODO: re-enable push after launch — expo-notifications removed due to
// provisioning conflict.

function logPushDisabled(action: string): void {
  if (__DEV__) {
    console.log(`[push] ${action} skipped: push disabled`);
  }
}

export async function registerPushToken(userId: string): Promise<void> {
  void userId;
  logPushDisabled('registerPushToken');
  await Promise.resolve();
}

export function setupNotificationHandler(): void {
  logPushDisabled('setupNotificationHandler');
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  void userId;
  void title;
  void body;
  void data;
  logPushDisabled('sendPushToUser');
  await Promise.resolve();
}

export async function remindDebtor(
  debtorUserId: string,
  groupName: string,
  amount: string,
  currency: string,
): Promise<void> {
  void debtorUserId;
  void groupName;
  void amount;
  void currency;
  logPushDisabled('remindDebtor');
  await Promise.resolve();
}
