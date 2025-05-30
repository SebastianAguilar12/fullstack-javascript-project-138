import path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import PageLoaderError from './errors.js';
import {
  getWebsiteSlugName,
  downloadingDirName,
  makeDashedFileName,
  processedResources,
  downloadAssetsSequentially,
}
  from './utils.js';

const errorMessages = {
  EACCES: 'Permiso denegado. No puedes escribir en el directorio.',
  ENOENT: 'Archivo o directorio no encontrado.',
  ENOTDIR: 'Esperaba un directorio pero encontré un archivo.',
  EISDIR: 'Esperaba un archivo pero encontré un directorio.',
  EBUSY: 'El archivo o directorio está en uso.',
  ECONNREFUSED: 'No se pudo conectar con el servidor.',
  ENOTFOUND: 'Servidor no encontrado.',
  ETIMEDOUT: 'La conexión tardó demasiado y fue cancelada.',
};

export default function getFileFromURL(webSite, savingDir = process.cwd()) {
  const webSiteSlugName = getWebsiteSlugName(webSite);
  const url = new URL(webSite);
  const webSiteNameWithExtension = `${makeDashedFileName(webSiteSlugName)}.html`;
  const webSiteNameWithExtensionPath = path.join(savingDir, webSiteNameWithExtension);
  const dirContainer = downloadingDirName(webSite);
  const dirContainerPath = path.join(savingDir, dirContainer);
  fs.access(savingDir, fs.constants.W_OK, (notAccess) => {
    if (notAccess) {
      fs.promises.mkdir(dirContainerPath, { recursive: true })
        .then(() => console.log(`Directorio ${savingDir} creado.`));
    } else {
      console.log(`Directorio ${savingDir} ya existe.`);
    }
  });
  return axios.get(webSite)
    .then((response) => {
      const htmlContent = response.data;
      const data = processedResources(url.origin, dirContainerPath, htmlContent);
      return fs.promises.writeFile(webSiteNameWithExtensionPath, data.html, 'utf-8')
        .then(() => data);
    })
    // Descargar assets data.assets.map(downloadAsset)
    .then((data) => {
      // console.log(data.assets);
      console.log(`🔎 Descargando ${webSite}...`);
      return downloadAssetsSequentially(dirContainerPath, data.assets)
        .then(() => ({
          filepath: webSiteNameWithExtensionPath,
          assetsDownloaded: data.assets.length,
        }));
    })
    .catch((error) => {
      const message = errorMessages[error.code] || `❌ Error desconocido: ${error.message}`;
      if (error.code === 'EACCES') {
        throw new PageLoaderError(`❌ Permiso denegado. No puedes escribir en el directorio: ${savingDir}`);
      } else if (error.code === 'ENOENT') {
        throw new PageLoaderError(`❌ El directorio de destino: ${savingDir} no existe`);
      } else if (error.code === 'ENOTDIR') {
        throw new PageLoaderError(`❌ Se esperaba un directorio, pero la ruta: ${savingDir} no es un directorio`);
      }
      throw new Error(`${message} 🕵️‍♂️, el archivo no fue encontrado. Verifica que la URL esté bien escrita o que el archivo no haya sido removido`); // o relanzarlo para que el bin lo atrape
    });
}
