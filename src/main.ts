import { app, BrowserWindow, ipcMain } from 'electron';
// import isDev from 'electron-is-dev'; // New Import

import path from "path";
const isDev = !app.isPackaged;


const { update, query, checkOrMakeTables, run } = require( './server/database');

let win;

const createWindow = (): void => {
  win = new BrowserWindow({
    width: 1500,
    height: 1000,
    title: "Bot Portfolio Manager",
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      worldSafeExecuteJavaScript: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // icon: appIcon

  });

  console.log(isDev);

  if (isDev) {
		win.webContents.openDevTools();
	}

  win.loadURL(
    isDev
      ? 'http://localhost:9000'
      : `file://${app.getAppPath()}/index.html`,
  );
}

app.on('ready', createWindow);

import { config } from './utils/config';

ipcMain.handle('allConfig', (event, value) => {
  if (value != null) return config.get(value)
  return config.store
});

ipcMain.handle('setStoreValue', (event, key, value) => {
  if (key === null) return config.set(value);
  return config.set(key, value);
});

ipcMain.handle('setBulkValues', (event, values) => {
  const newThings = config.set(values)
  return newThings
});

ipcMain.handle('config-clear', (event) => {
  return config.clear()
});



/**
 * 
 *      Database Functions
 * 
 */



 ipcMain.handle('query-database', (event, queryString) => {

  console.log('running from the main process' + " " + queryString)
  return query(queryString)
});

ipcMain.handle('update-database', (event, table, updateData) => {
  return update(table, updateData)
});

ipcMain.handle('run-database', (event, queryString) => {
  return run(queryString)
});

ipcMain.handle('database-checkOrMakeTables', (event) => {
  console.log('attempting to check if tables exist yet.')
  checkOrMakeTables()
});


/**
 * 
 *      3C API functions
 * 
 */

// @ts-ignore
 const { updateAPI, bots, getDealsBulk, getDealsUpdate, getAndStoreBotData } = require('./server/threeC/index');


 ipcMain.handle('api-getDealsBulk', (event, limit) => {
   return getDealsBulk(limit)
 });
 
 ipcMain.handle('api-getDealsUpdate', (event, limit) => {
   return getDealsUpdate(limit)
 });
 
 ipcMain.handle('api-updateData', async (event, limit) => {
   await updateAPI(limit)
 });
 
 ipcMain.handle('api-getBots', async (event) => {
   await getAndStoreBotData()
 });