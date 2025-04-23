import path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import {
  getWebsiteSlugName,
  downloadingDirName,
  makeDashedFileName,
  downloadAsset,
  processedResources,
}
  from './utils.js';

export default function getFileFromURL(webSite, savingDir = process.cwd()) {
  const webSiteSlugName = getWebsiteSlugName(webSite);
  const url = new URL(webSite);
  const webSiteNameWithExtension = `${makeDashedFileName(webSiteSlugName)}.html`;
  const webSiteNameWithExtensionPath = path.join(savingDir, webSiteNameWithExtension);
  const dirContainer = downloadingDirName(webSite);
  const dirContainerPath = path.join(savingDir, dirContainer);
  return axios.get(webSite)
    .then((response) => {
      const htmlContent = response.data;
      const data = processedResources(url.origin, dirContainerPath, htmlContent);
      return fs.promises.writeFile(webSiteNameWithExtensionPath, data.html, 'utf-8')
        .then(() => data);
    })
    // Descargar assets data.assets.map(downloadAsset)
    .then((data) => {
      console.log(data.assets);
      return Promise.all(
        data.assets.map((asset) => downloadAsset(dirContainerPath, asset))
      );
    })
    .then(()=>console.log(`Assets downloaded successfully.`))
    .catch((error) => {
      throw new Error(`Failed to download HTML: ${error.message}`);
    });
}
