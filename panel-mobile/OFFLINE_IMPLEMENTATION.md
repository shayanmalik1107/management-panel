# LAMBA offline implementation

This update adds a local-first offline workflow to the existing React/Firebase panel while preserving the existing screens and services.

## Included in this update

- IndexedDB remains the durable local outbox/cache. Outbox records now carry a stable browser `deviceId`, and the database adds `userId`/`deviceId` indexes.
- The browser app shell is cached by `public/sw.js` after the first successful online production visit. Firebase data and user records are not placed in the service-worker cache.
- The previously authenticated account profile/company/role/permission snapshot remains available from the existing local session cache. No password is saved in that cache.
- Outbox synchronization is restricted to the currently authenticated/cached account, processes records FIFO, stops at the first failed dependent operation, and retains records until Firebase acknowledges them.
- Offline orders are stored locally with the order/activity/notification payload. The employee device does not decrement cached stock. The order number includes a device suffix to avoid collisions between offline devices.
- On synchronization, an offline order is applied in one Realtime Database transaction at the company node. The transaction writes the order, deducts the current cloud stock (negative stock is permitted), updates customer totals/balance, writes stock movements/activity/notification, and records an idempotency marker. A retry for the same order ID will not deduct stock twice.
- Sale price and `costPriceAtSale` are retained in the saved order line items.
- Admin-created products and product edits can be queued offline. Pending product changes are overlaid only for the account that created them; they are not inserted into the shared company product cache. Initial-stock purchase data is queued with an offline product when supplied.
- Employees see cached stock as **Last synced stock** while offline, with the local cache timestamp and a warning that stock may have changed.
- Employee sale-price overrides are disabled while offline because an offline device cannot know whether the admin has revoked that permission. The last permission snapshot timestamp is shown in the offline order notice.

## Important deployment steps

1. Install dependencies in the project folder with `npm install`.
2. Review and harden the existing Realtime Database rules with a Firebase Emulator test suite before production. The included rules are preserved from your source project and are not a complete role-security policy.
3. Build and deploy the Vite app over HTTPS. Service workers do not work on ordinary insecure HTTP origins (localhost is the development exception).
4. After this update, an admin should select the intended company once while online so the selected workspace is persisted on that browser. Open the deployed app while online once so the service worker can install and cache the built entry files. Then test offline by closing/reopening the browser or restarting the computer.
5. Keep the real `.env` file outside source control and use `.env.example` to configure server secrets on the hosting provider.

## Current scope and limitations

- Offline creation of orders and customers, admin product creation/editing, and offline browsing of cached products/customers/orders are covered by this update.
- Purchases, expenses, supplier payments, customer receipts, warehouse transfers, order returns/status changes, and other financial mutations have not all been converted to offline outbox operations in this pass. Treat those actions as online-only until they receive their own queue handlers and reconciliation rules.
- The offline session is a convenience for a previously authenticated browser profile, not a cryptographic device-attestation system. Local browser storage can be cleared or modified by someone with access to the computer. Remote account disablement or permission revocation cannot be discovered while disconnected. Sensitive actions should remain online-only.
- The ZIP's existing `database.rules.json` was preserved to avoid breaking its current registration/company-join flows. It grants company members broad write access and allows users to write their own profile, so the admin-only product guard is currently enforced by the app UI/local queue, not by a hardened server authorization boundary. Before production, move privileged profile/role changes and inventory commands behind trusted backend code and deploy tested role-aware RTDB rules. Do not treat client-side role checks as security.
- IndexedDB persistence can be denied by the browser and local data can still be lost if the user clears site data, removes the browser profile, or loses the device. Persistent storage is requested but is not a backup.
- Offline order idempotency uses a transaction at `companies/{companyId}` so stock, order, and customer updates commit together. This is safe for the requested retry/concurrent-offline-order behavior but can become expensive for very large company records. For high-volume production tenants, move this command processing to a trusted Cloud Function/backend and keep the same idempotency key contract.
- Online order creation still uses the existing online write path. If you need every online and offline sale to share one concurrency-safe stock command path, migrate the online order flow to the same transactional command processor as a follow-up.

## Manual test checklist

1. Sign in online and open the intended company on each device/account. Load products, customers, and orders so local snapshots exist.
2. On an employee device, disconnect the network. Confirm the cached product list displays **Last synced stock** and the timestamp.
3. Create multiple orders, including quantities that exceed the displayed stock. Confirm the displayed cached stock does not decrease and each order shows as pending/local.
4. Reconnect both employee devices. Confirm orders synchronize and each order appears once. Confirm company stock is reduced by the sum of all synced order quantities and can become negative.
5. Simulate a retry (for example, reload while an item is pending). Confirm the same order ID is not deducted twice.
6. As admin, create/edit a product offline. Confirm it appears for the admin's local account only, then reconnect and verify it appears to employees after their next sync.
7. Change an employee permission as admin while the employee is offline. Confirm the employee retains the last synchronized snapshot offline and receives the new permission after reconnecting.
8. Test the deployed production URL after closing/reopening Chrome while offline. Confirm the app shell opens and cached business data is available.
