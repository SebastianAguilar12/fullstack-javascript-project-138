import path from 'path';
import axios from 'axios';
import * as fs from 'fs';
import makeDashedFileName from './utils.js';

export default function getFileFromURL(webSite, savingDir = process.cwd()) {
  // console.log(`URL recibida: ${webSite}`);
  const webSiteURL = new URL(webSite);
  const webSiteName = webSiteURL.hostname + webSiteURL.pathname;
  const webSiteNameWithExtension = `${makeDashedFileName(webSiteName)}.html`;
  const webSiteNameWithExtensionPath = path.join(savingDir, webSiteNameWithExtension);
  return axios.get(webSite)
    .then((response) => new Promise((resolve, reject) => {
      const writableFile = fs.createWriteStream(webSiteNameWithExtensionPath);
      writableFile.write(response.data);
      writableFile.on('finish', () => {
        resolve(webSiteNameWithExtensionPath);
        // console.log(`Archivo descargado en: ${webSiteNameWithExtensionPath}`);
      });
      writableFile.on('error', (error) => {
        reject(error);
      });
      writableFile.end();
    }))
    .catch((error) => {
      console.log('Error al descargar la página: ', error);
      throw new Error('Error al descargar la página: ', error);
    });
}
