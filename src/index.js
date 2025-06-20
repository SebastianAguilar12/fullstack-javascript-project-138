import path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import PageLoaderError from './errors.js';
import {
  getWebsiteSlugName,
  downloadingDirName,
  makeDashedFileName,
  processedResources,
  downloadAssetsConcurrently,
  sanitizeOutputDir,
} from './utils.js';

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
  const sanitizedDir = sanitizeOutputDir(savingDir);
  if (!sanitizedDir) {
    return Promise.reject(
      new PageLoaderError(`❌ No se puede usar el directorio restringido: ${savingDir}`),
    );
  }

  const webSiteSlugName = getWebsiteSlugName(webSite);
  const url = new URL(webSite);
  const htmlFileName = `${makeDashedFileName(webSiteSlugName)}.html`;
  const assetsDirName = downloadingDirName(webSite);
  const assetsDirPath = path.join(sanitizedDir, assetsDirName);
  const htmlFilePath = path.join(sanitizedDir, htmlFileName);

  return fs.promises.access(sanitizedDir, fs.constants.W_OK)
    .then(() => fs.promises.mkdir(assetsDirPath, { recursive: true }))
    .then(() => axios.get(webSite))
    .then((response) => {
      if (typeof response.data !== 'string') {
        throw new PageLoaderError(`❌ El contenido descargado no es HTML válido desde ${webSite}`);
      }

      const htmlContent = response.data;
      const data = processedResources(url.origin, assetsDirPath, htmlContent);
      return fs.promises.writeFile(htmlFilePath, data.html, 'utf-8')
        .then(() => data);
    })
    .then((data) => {
      return downloadAssetsConcurrently(assetsDirPath, data.assets)
        .then(() => ({
          filepath: htmlFilePath,
          assetsDownloaded: data.assets.length,
        }));
    })
    .catch((error) => {
      const code = error.code || error.cause?.code;
      const message = errorMessages[code] || `❌ Error desconocido: ${error.message}`;

      if (code === 'EACCES') {
        throw new PageLoaderError(`❌ Permiso denegado. No puedes escribir en el directorio: ${savingDir}`);
      }
      if (code === 'ENOENT') {
        throw new PageLoaderError(`❌ El directorio de destino: ${savingDir} no existe`);
      }
      if (code === 'ENOTDIR') {
        throw new PageLoaderError(`❌ Se esperaba un directorio, pero la ruta: ${savingDir} no es un directorio`);
      }
      if (code === 'ENOTFOUND') {
        throw new PageLoaderError(`❌ No se pudo resolver el host: ${error.config?.url || 'URL desconocida'}`);
      }
      if (code === 'ECONNREFUSED') {
        throw new PageLoaderError(`❌ El servidor rechazó la conexión: ${error.config?.url || 'URL desconocida'}`);
      }

      throw new PageLoaderError(`${message} 🕵️‍♂️, el archivo no fue encontrado. Verifica que la URL esté bien escrita o que el archivo no haya sido removido`);
    });
}
