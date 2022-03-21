import { ProfileType } from '@/types/config';

import {
  mainPreload, UpdateDealRequest, Type_UpdateFunction, getDealOrders, defaultConfig,
} from '@/types/preload';

const { contextBridge, ipcRenderer } = require('electron');

async function setupContextBridge() {
  contextBridge.exposeInMainWorld('mainPreload', {
    deals: {
      async update(profileData: ProfileType, deal: UpdateDealRequest): Promise<mainPreload['deals']['update']> {
        return ipcRenderer.invoke('api-deals-update', profileData, deal);
      },
    },
    api: {
      async update(
        type: string,
        options: Type_UpdateFunction,
        profileData: ProfileType,
      ): Promise<mainPreload['api']['update']> {
        console.log('Updating 3Commas data.');
        return ipcRenderer.invoke('api-updateData', type, options, profileData);
      },
      async updateBots(profileData: ProfileType): Promise<void> {
        console.log('Fetching Bot Data');
        await ipcRenderer.invoke('api-getBots', profileData);
      },
      async getAccountData(
        profileData: ProfileType,
        key?: string,
        secret?: string,
        mode?: string,
      ): Promise<ReturnType<typeof getDealOrders>> {
        return ipcRenderer.invoke('api-getAccountData', profileData, key, secret, mode);
      },
      async getDealOrders(profileData: ProfileType, dealID: number) {
        return ipcRenderer.invoke('api-getDealOrders', profileData, dealID);
      },
    },
    config: {
      get: async (value: string | 'all'): Promise<any> => {
        console.log('fetching Config');
        return ipcRenderer.invoke('allConfig', value);
      },
      profile: async (type: 'create', newProfile: ProfileType, profileId: string) => {
        if (type === 'create') {
          // storing the initial config values
          await ipcRenderer.invoke('setStoreValue', `profiles.${profileId}`, newProfile);
          await ipcRenderer.invoke('database-checkOrMakeTables', profileId);
        }
      },

      // gets the value for the current profile
      getProfile: async (
        value: string,
        profileId: string,
      ): Promise<ProfileType | undefined> => ipcRenderer.invoke(
        'allConfig',
        `profiles.${profileId}${value ? `.${value}` : ''}`,
      ),

      async reset(): Promise<void> {
        /**
         * TODO
         * - Add error handling for default config here.
         */
        console.log('attempting to reset the config to default values.');
        await ipcRenderer.invoke('config-clear');
      },
      async set(key: string, value: any): Promise<void> {
        console.log('writing Config');
        await ipcRenderer.invoke('setStoreValue', key, value);
      },

      bulk: async (changes: typeof defaultConfig): Promise<void> => ipcRenderer.invoke('setBulkValues', changes),
    },
    database: {
      async query(profileId: string, queryString: string) {
        console.log('running database query');
        console.log(queryString);
        return ipcRenderer.invoke('query-database', profileId, queryString);
      },
      update(profileId: string, table: string, updateData: object[]): void {
        ipcRenderer.invoke('update-database', profileId, table, updateData);
      },
      upsert(
        profileId: string,
        table: string,
        data: any[],
        id: string,
        updateColumn: string,
      ): void {
        ipcRenderer.invoke('upsert-database', profileId, table, data, id, updateColumn);
      },
      run(profileId: string, query: string): void {
        ipcRenderer.invoke('run-database', profileId, query);
      },
      async deleteAllData(profileID?: string): Promise<void> {
        console.log('deleting all data!');
        await ipcRenderer.invoke('database-deleteAll', profileID);
      },
    },
    general: {
      openLink(link: string) {
        ipcRenderer.invoke('open-external-link', link);
      },
    },
    binance: {
      coinData: async () => ipcRenderer.invoke('binance-getCoins'),
    },
    pm: {
      versions: async () => ipcRenderer.invoke('pm-versions'),
    },
  });
}

async function preloadCheck() {
  await ipcRenderer.invoke('preload-check');
}

preloadCheck();
// databaseSetup();
setupContextBridge();

export default setupContextBridge;
