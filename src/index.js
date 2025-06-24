import path from 'path';
import beautify from 'js-beautify';
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
  const htmlFilePathOutside = path.join(sanitizedDir, htmlFileName); // sin modificaciones
  const htmlFilePathInside = path.join(assetsDirPath, htmlFileName); // con modificaciones

  return fs.promises.access(sanitizedDir, fs.constants.W_OK)
    .then(() => fs.promises.mkdir(assetsDirPath, { recursive: true }))
    .then(() => axios.get(webSite))
    .then((response) => {
      if (typeof response.data !== 'string') {
        throw new PageLoaderError(`❌ El contenido descargado no es HTML válido desde ${webSite}`);
      }

      const originalHtml = response.data;

      // Procesar para modificar rutas relativas
      const { html: modifiedHtml, assets } = processedResources(
        url.origin,
        assetsDirPath,
        originalHtml,
      );

      // Beautify ambas versiones
      const formattedOriginalHtml = beautify.html(originalHtml, {
        indent_inner_html: true,
        indent_size: 4,
        preserve_newlines: true,
        wrap_line_length: 0,
        end_with_newline: true,
        unformatted: [],
      });

      const formattedModifiedHtml = beautify.html(modifiedHtml, {
        indent_inner_html: true,
        indent_size: 4,
        preserve_newlines: true,
        wrap_line_length: 0,
        end_with_newline: true,
        unformatted: [],
      });

      // Guardar los dos HTMLs
      return Promise.all([
        fs.promises.writeFile(htmlFilePathOutside, formattedOriginalHtml, 'utf-8'),
        fs.promises.writeFile(htmlFilePathInside, formattedModifiedHtml, 'utf-8'),
      ]).then(() => downloadAssetsConcurrently(assetsDirPath, assets)
        .then(() => ({
          filepath: htmlFilePathOutside,
          assetsDownloaded: assets.length,
        })));
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
