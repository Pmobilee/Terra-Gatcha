# AR-12: Anonymous Auth & Cloud Save
> Phase: Backend — Data Persistence
> Priority: HIGH
> Depends on: AR-08 (Hub with Settings), Fastify backend (already exists)
> Estimated scope: L

Players currently have all progress stored only in localStorage. No progress persists across devices. This phase implements device-based anonymous identity (UUID) with optional account creation, and a cloud save system so progress synchronizes across devices or survives app reinstall.

## Design Reference

From GAME_DESIGN.md Section 31 (Player Identity & Cloud):

> Anonymous play: UUID generated on first launch, stored locally. All progress saved to cloud under UUID. Optional account creation (email + password or OAuth) to claim the anonymous profile. No login required to play.

From GAME_DESIGN.md Section 32 (Save System):

> Cloud saves push after every encounter. Pull on app launch. Conflict resolution: prefer higher-progress state. FSRS data, run history, unlocks, profile settings all synced.

## Implementation

### Sub-task 1: Anonymous Device Identity

#### Device UUID Generation

```typescript
// In src/services/identityService.ts

const DEVICE_ID_KEY = 'terra:device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  // Check localStorage first
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate new UUID v4
    deviceId = generateUUIDv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log(`Generated new device ID: ${deviceId}`);
  }

  return deviceId;
}

function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceInfo(): Promise<{ deviceId: string; userAgent: string; createdAt: string }> {
  const deviceId = await getOrCreateDeviceId();
  const createdAt = localStorage.getItem(`${DEVICE_ID_KEY}:created_at`) || new Date().toISOString();
  if (!localStorage.getItem(`${DEVICE_ID_KEY}:created_at`)) {
    localStorage.setItem(`${DEVICE_ID_KEY}:created_at`, createdAt);
  }

  return {
    deviceId,
    userAgent: navigator.userAgent,
    createdAt,
  };
}
```

#### Data Model

```typescript
// In src/data/types.ts

interface PlayerProfile {
  // ... existing fields
  deviceId: string;  // Anonymous UUID
  accountId?: string;  // Set after account creation/login
  accountEmail?: string;
  accountCreatedAt?: string;
  cloudSyncEnabled: boolean;  // Default true
  lastCloudSyncAt?: string;  // ISO timestamp
  lastLocalChangeAt?: string;  // Track if local is newer
}

interface CloudProfile {
  deviceId: string;
  accountId?: string;
  profile: PlayerProfile;
  factStates: Map<string, PlayerFactState>;
  runHistory: RunRecord[];
  settings: PlayerSettings;
  unlocks: UnlockState;
  syncedAt: string;  // Server timestamp
}
```

### Sub-task 2: Cloud Save Endpoints (Fastify Backend)

Assuming Fastify backend exists (already mentioned in codebase):

```typescript
// In backend/src/routes/saves.ts

import { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';

export async function setupSavesRoute(app: FastifyInstance) {
  // Register JWT secret
  app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-key' });

  // POST /api/saves/push — Upload player state
  app.post<{ Body: CloudProfile }>('/api/saves/push', async (request, reply) => {
    const { deviceId, profile, factStates, runHistory, settings, unlocks } = request.body;

    // Validate deviceId
    if (!deviceId || deviceId.length === 0) {
      return reply.code(400).send({ error: 'deviceId required' });
    }

    try {
      // Store in database (PostgreSQL or similar)
      const saved = await db.query(
        `INSERT INTO cloud_saves (device_id, account_id, profile_json, fact_states_json, run_history_json, unlocks_json, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (device_id) DO UPDATE SET
           profile_json = $3, fact_states_json = $4, run_history_json = $5, unlocks_json = $6, synced_at = NOW()
         RETURNING synced_at`,
        [
          deviceId,
          profile.accountId || null,
          JSON.stringify(profile),
          JSON.stringify(Array.from(factStates.entries())),
          JSON.stringify(runHistory),
          JSON.stringify(unlocks),
        ]
      );

      return reply.code(200).send({
        success: true,
        syncedAt: saved.rows[0].synced_at,
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      return reply.code(500).send({ error: 'Failed to save profile' });
    }
  });

  // GET /api/saves/pull — Download player state
  app.get<{ Querystring: { deviceId: string } }>('/api/saves/pull', async (request, reply) => {
    const { deviceId } = request.query;

    if (!deviceId || deviceId.length === 0) {
      return reply.code(400).send({ error: 'deviceId required' });
    }

    try {
      const result = await db.query(
        `SELECT profile_json, fact_states_json, run_history_json, unlocks_json, synced_at
         FROM cloud_saves WHERE device_id = $1 LIMIT 1`,
        [deviceId]
      );

      if (result.rows.length === 0) {
        // No save found
        return reply.code(404).send({ error: 'No save found for this device' });
      }

      const row = result.rows[0];
      return reply.code(200).send({
        profile: JSON.parse(row.profile_json),
        factStates: new Map(JSON.parse(row.fact_states_json)),
        runHistory: JSON.parse(row.run_history_json),
        unlocks: JSON.parse(row.unlocks_json),
        syncedAt: row.synced_at,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      return reply.code(500).send({ error: 'Failed to load profile' });
    }
  });

  // POST /api/auth/account-create — Create account from anonymous
  app.post<{ Body: { deviceId: string; email: string; password: string } }>(
    '/api/auth/account-create',
    async (request, reply) => {
      const { deviceId, email, password } = request.body;

      if (!deviceId || !email || !password) {
        return reply.code(400).send({ error: 'deviceId, email, password required' });
      }

      try {
        // Hash password (bcrypt recommended)
        const hashedPassword = await hashPassword(password);

        // Create account
        const accountResult = await db.query(
          `INSERT INTO accounts (device_id, email, password_hash, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id, created_at`,
          [deviceId, email, hashedPassword]
        );

        const accountId = accountResult.rows[0].id;

        // Link existing save to account
        await db.query(
          `UPDATE cloud_saves SET account_id = $1 WHERE device_id = $2`,
          [accountId, deviceId]
        );

        // Issue session token
        const token = app.jwt.sign({ accountId, deviceId, email }, { expiresIn: '7d' });

        return reply.code(201).send({
          accountId,
          token,
          email,
        });
      } catch (error) {
        console.error('Error creating account:', error);
        return reply.code(500).send({ error: 'Failed to create account' });
      }
    }
  );

  // POST /api/auth/login — Login to existing account
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.code(400).send({ error: 'email, password required' });
      }

      try {
        const result = await db.query(
          `SELECT id, device_id, password_hash FROM accounts WHERE email = $1 LIMIT 1`,
          [email]
        );

        if (result.rows.length === 0) {
          return reply.code(401).send({ error: 'Invalid email or password' });
        }

        const account = result.rows[0];
        const passwordMatch = await verifyPassword(password, account.password_hash);

        if (!passwordMatch) {
          return reply.code(401).send({ error: 'Invalid email or password' });
        }

        // Issue token
        const token = app.jwt.sign(
          { accountId: account.id, deviceId: account.device_id, email },
          { expiresIn: '7d' }
        );

        return reply.code(200).send({
          accountId: account.id,
          deviceId: account.device_id,
          token,
          email,
        });
      } catch (error) {
        console.error('Error logging in:', error);
        return reply.code(500).send({ error: 'Login failed' });
      }
    }
  );
}
```

### Sub-task 3: Conflict Resolution

When pulling from cloud, compare local vs. remote:

```typescript
// In src/services/cloudSyncService.ts

export type ConflictResolution = 'local' | 'remote' | 'merged';

export async function resolveConflict(
  local: CloudProfile,
  remote: CloudProfile
): Promise<{ resolved: CloudProfile; resolution: ConflictResolution }> {
  // Compare progress markers
  const localRunsCount = local.runHistory.length;
  const remoteRunsCount = remote.runHistory.length;
  const localFloorRecord = Math.max(...local.runHistory.map(r => r.floorReached), 0);
  const remoteFloorRecord = Math.max(...remote.runHistory.map(r => r.floorReached), 0);

  // If timestamps diverge by >1 hour, prefer higher progress (runs/floor)
  const localTime = new Date(local.syncedAt).getTime();
  const remoteTime = new Date(remote.syncedAt).getTime();
  const timeDiff = Math.abs(localTime - remoteTime);

  if (timeDiff > 3600000) {
    // >1 hour difference
    if (localRunsCount > remoteRunsCount || localFloorRecord > remoteFloorRecord) {
      console.log('Conflict: Preferring local (more runs/higher floor)');
      return { resolved: local, resolution: 'local' };
    } else if (remoteRunsCount > localRunsCount || remoteFloorRecord > localFloorRecord) {
      console.log('Conflict: Preferring remote (more runs/higher floor)');
      return { resolved: remote, resolution: 'remote' };
    }
  }

  // If <1 hour difference, consider merged (local + remote runs)
  const merged: CloudProfile = {
    ...remote,  // Start with remote
    runHistory: [
      ...remote.runHistory,
      ...local.runHistory.filter(
        r => !remote.runHistory.some(rr => rr.id === r.id)
      ),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };

  // Merge FSRS states: take highest stability for each fact
  const mergedFactStates = new Map(remote.factStates);
  for (const [factId, localState] of local.factStates) {
    const remoteState = mergedFactStates.get(factId);
    if (!remoteState) {
      mergedFactStates.set(factId, localState);
    } else {
      // Keep state with higher stability (better learned)
      if (localState.stability > remoteState.stability) {
        mergedFactStates.set(factId, localState);
      }
    }
  }

  merged.factStates = mergedFactStates;

  return { resolved: merged, resolution: 'merged' };
}
```

### Sub-task 4: Save Service Integration

Integrate cloud sync into existing save service:

```typescript
// In src/services/saveService.ts (extend existing)

export class SaveService {
  async savePlayerProfile(profile: PlayerProfile): Promise<void> {
    // Save locally first
    const localData = JSON.stringify(profile);
    await preferences.set({ key: 'playerProfile', value: localData });

    // If cloud sync enabled, push to server
    if (profile.cloudSyncEnabled && profile.deviceId) {
      try {
        const response = await fetch('/api/saves/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: profile.deviceId,
            profile,
            factStates: Array.from(this.playerFactStates.entries()),
            runHistory: this.runHistory,
            settings: this.settings,
            unlocks: this.unlocks,
          }),
        });

        if (response.ok) {
          profile.lastCloudSyncAt = new Date().toISOString();
          console.log('Profile synced to cloud');
        }
      } catch (error) {
        console.warn('Cloud sync failed (local save preserved):', error);
      }
    }
  }

  async loadPlayerProfile(): Promise<PlayerProfile> {
    // Load local first
    let local = await this.loadLocalProfile();

    // If online and sync enabled, pull from cloud
    if (navigator.onLine && local?.cloudSyncEnabled && local?.deviceId) {
      try {
        const response = await fetch(`/api/saves/pull?deviceId=${local.deviceId}`);

        if (response.ok) {
          const remote = await response.json();

          // Resolve conflicts
          const { resolved } = await resolveConflict(local, remote);
          console.log('Loaded from cloud and merged local changes');

          return resolved;
        }
      } catch (error) {
        console.warn('Could not reach cloud (using local):', error);
      }
    }

    return local;
  }

  private async loadLocalProfile(): Promise<PlayerProfile> {
    const stored = await preferences.get({ key: 'playerProfile' });
    if (!stored?.value) return this.createDefaultProfile();

    return JSON.parse(stored.value);
  }

  private createDefaultProfile(): PlayerProfile {
    return {
      deviceId: await getOrCreateDeviceId(),
      runsCompleted: 0,
      cloudSyncEnabled: true,
      // ... other defaults
    };
  }
}
```

### Sub-task 5: Login UI

Add minimal login flow to Settings:

```svelte
<!-- src/ui/components/AccountSettings.svelte -->
<script>
  import { onMount } from 'svelte';

  let profile = getPlayerProfile();
  let isLoggedIn = !!profile.accountId;
  let email = profile.accountEmail || '';
  let password = '';
  let showLogin = false;
  let isCreatingAccount = false;
  let errorMessage = '';

  async function handleCreateAccount() {
    if (!email || !password) {
      errorMessage = 'Email and password required';
      return;
    }

    isCreatingAccount = true;
    try {
      const response = await fetch('/api/auth/account-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: profile.deviceId,
          email,
          password,
        }),
      });

      if (response.ok) {
        const { accountId, token } = await response.json();
        profile.accountId = accountId;
        profile.accountEmail = email;
        localStorage.setItem('terra:auth_token', token);
        isLoggedIn = true;
        showLogin = false;
        await saveService.savePlayerProfile(profile);
      } else {
        const error = await response.json();
        errorMessage = error.error || 'Account creation failed';
      }
    } catch (error) {
      errorMessage = 'Network error';
    } finally {
      isCreatingAccount = false;
    }
  }

  async function handleLogout() {
    profile.accountId = undefined;
    profile.accountEmail = undefined;
    localStorage.removeItem('terra:auth_token');
    isLoggedIn = false;
    await saveService.savePlayerProfile(profile);
  }
</script>

<div class="account-settings">
  {#if isLoggedIn}
    <div class="logged-in">
      <p>Logged in as: <strong>{profile.accountEmail}</strong></p>
      <button on:click={handleLogout}>Logout</button>
      <label>
        <input type="checkbox" bind:checked={profile.cloudSyncEnabled} />
        Cloud Sync Enabled
      </label>
    </div>
  {:else}
    <button on:click={() => showLogin = !showLogin}>
      {showLogin ? 'Cancel' : 'Create Account / Login'}
    </button>

    {#if showLogin}
      <div class="login-form">
        <input
          type="email"
          placeholder="Email"
          bind:value={email}
          disabled={isCreatingAccount}
        />
        <input
          type="password"
          placeholder="Password"
          bind:value={password}
          disabled={isCreatingAccount}
        />
        {#if errorMessage}
          <div class="error">{errorMessage}</div>
        {/if}
        <button
          on:click={handleCreateAccount}
          disabled={isCreatingAccount || !email || !password}
        >
          {isCreatingAccount ? 'Creating...' : 'Create Account'}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .account-settings {
    padding: 16dp;
  }

  .logged-in {
    background: rgba(0, 128, 0, 0.1);
    padding: 12dp;
    border-radius: 4dp;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 8dp;
    margin-top: 12dp;
  }

  input {
    padding: 8dp;
    border: 1px solid #666;
    border-radius: 4dp;
  }

  .error {
    color: red;
    font-size: 12dp;
  }

  button {
    padding: 8dp 16dp;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4dp;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

### Sub-task 6: Auto-Sync on Run Completion

After each run completes, trigger cloud save:

```typescript
// In src/services/gameFlowController.ts

export async function completeRun(runState: CardRunState): Promise<void> {
  // ... existing run completion logic

  // Auto-save to cloud
  const profile = getPlayerProfile();
  await saveService.savePlayerProfile(profile);

  // Log sync status
  console.log(`Run saved. Last cloud sync: ${profile.lastCloudSyncAt}`);
}
```

### Sub-task 7: Guest-to-Account Migration

When anonymous player creates account, existing localStorage data transfers:

```typescript
// In src/services/accountService.ts

export async function claimAnonymousProfile(
  deviceId: string,
  email: string,
  password: string
): Promise<{ accountId: string; token: string }> {
  // Create account on server (already done in Sub-task 2)
  // Local profile automatically linked because deviceId matches

  // On success, set accountId in profile
  const profile = getPlayerProfile();
  profile.accountId = accountId;
  profile.accountEmail = email;
  await saveService.savePlayerProfile(profile);

  // Next cloud sync will push all accumulated data
  return { accountId, token };
}
```

## System Interactions

- **Hub Navigation (AR-08):** Settings screen includes account options.
- **Save Service:** All existing save logic unchanged. Cloud sync is transparent.
- **Offline Mode:** Cloud sync gracefully fails; local play continues unaffected.
- **Run Completion:** Auto-triggers cloud save (Sub-task 6).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Device ID generated on first launch | Same device always has same ID. Persists across app reinstalls. |
| Player creates account, plays on phone, signs in on tablet | New device. Gets own device ID but shares account. Cloud pull resolves which save is newest. |
| Network fails during cloud push | Local save preserved. Retry on next sync opportunity. No data loss. |
| Local and remote differ by 2 hours, local has 3 more runs | Merged: include all runs, merge FSRS (higher stability wins). |
| Player logs out and back in | AccountId cleared locally. Cloud save still exists under device ID. Can re-login with same email/password. |
| Player deletes app and reinstalls on same device | Device ID loaded from localStorage (persists). Pulls save from cloud. Progress restored. |
| Player plays offline for 1 hour, goes online | Local changes auto-sync on app resume. |
| Account created twice with same email | Backend returns 409 Conflict. UI shows "Email already in use." |
| Password reset (not in v1 scope) | Login only; no password reset. Noted for v2. |
| Cloud sync disabled in settings | No data sent to server. All saves local only. Can re-enable anytime. |
| Device with very old browser (no localStorage) | Fallback graceful? Or require modern browser? (Out of scope for this phase; note for AR-13 compatibility). |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/identityService.ts` | Device UUID generation and management |
| Create | `src/services/cloudSyncService.ts` | Conflict resolution, sync logic |
| Create | `src/services/accountService.ts` | Account creation, login, claim profile |
| Modify | `src/services/saveService.ts` | Add cloud push/pull, integrate identity |
| Create | `src/ui/components/AccountSettings.svelte` | Login/logout UI, cloud sync toggle |
| Modify | `src/ui/screens/SettingsMenu.svelte` | Include account settings component |
| Modify | `src/data/types.ts` | Add deviceId, accountId, cloudSyncEnabled to PlayerProfile |
| Create | `backend/src/routes/saves.ts` | Cloud save endpoints (Fastify) |
| Create | `backend/src/routes/auth.ts` | Account creation and login endpoints |
| Create | `backend/src/schema/database.sql` | Schema for cloud_saves, accounts tables |
| Modify | `src/services/gameFlowController.ts` | Auto-sync on run completion |
| Modify | `.env.example` | Add JWT_SECRET, DATABASE_URL for backend |

## Done When

- [ ] Device ID generated on first launch, persists in localStorage
- [ ] Cloud endpoints created: POST /api/saves/push, GET /api/saves/pull
- [ ] Account creation: POST /api/auth/account-create (email + password)
- [ ] Account login: POST /api/auth/login
- [ ] Cloud sync pulls on app launch if online
- [ ] Conflict resolution: merges runs, prefers higher FSRS stability per fact
- [ ] Anonymous player can create account without losing progress
- [ ] Logout clears accountId, keeps device ID
- [ ] Cloud sync disabled in settings prevents push/pull
- [ ] Auto-save on run completion sends data to cloud
- [ ] Re-install on same device: device ID restored, cloud save pulled
- [ ] Login UI in Settings: email, password, create/logout buttons
- [ ] Error handling: network failure → use local, graceful retry
- [ ] `npx vitest run` passes (new tests for sync/conflict logic)
- [ ] `npm run typecheck` passes
- [ ] Backend: `npm run build` succeeds, database schema deployed
