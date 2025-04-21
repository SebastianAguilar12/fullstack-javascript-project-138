import path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import {
  getWebsiteSlugName,
  downloadingDirName,
  makeDashedFileName,
  getImagesURL,
  downloadImage,
  getLocalAsset,
  downloadAsset,
  updateHTML,
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
  // Create directory first
  const createDirectory = new Promise((resolve, reject) => {
    fs.access(dirContainerPath, (notAccess) => {
      if (notAccess) {
        fs.mkdir(dirContainerPath, { recursive: true }, (error) => {
          if (error) {
            reject();
            throw new Error(`Failed to create directory ${dirContainerPath}: ${error.message}`);
          } else {
            resolve();
          }
        });
      } else {
        // console.log(`Directory ${dirContainerPath} already exists.`);
        resolve();
      }
    });
  });
  return createDirectory
    .then(() => axios.get(webSite)
        .then((response) => {
          const htmlContent = response.data;
          const data = processedResources(url.origin, dirContainerPath, htmlContent);
          console.log(data);
          // Verificar que el dir de los assets exista, si no, se crea
          fs.writeFile(webSiteNameWithExtensionPath, htmlContent, 'utf-8', (error) => {
            if (error) {
              throw new Error(`Failed to write HTML file: ${error.message}`);
            }
          });
        })
        // Descargar assets data.assets.map(downloadAsset)
        .catch((error) => {
          throw new Error(`Failed to download HTML: ${error.message}`);
        })
      // Handle images
    //   getImagesURL(webSite)
    //     .then((imagesURL) => imagesURL.reduce((promise, imageURL) => promise.then(() => downloadImage(imageURL, dirContainerPath)), Promise.resolve()))
    //     .then(() => console.log('Images downloaded successfully.')),
    //   getLocalAsset(webSite)
    //     .then((assetsURL) => assetsURL.reduce((promise, assetURL) => promise.then(() => downloadAsset(assetURL, dirContainerPath)), Promise.resolve()))
    //     .then(() => console.log('Assets downloaded successfully.')),
    )
    // .then(() => updateHTML(webSiteNameWithExtensionPath, dirContainerPath))
    // .then(() => {
    //   console.log('Website processed successfully.');
    //   return webSiteNameWithExtensionPath;
    // })
    .catch((error) => {
      console.log('Error in getFileFromURL: ', error);
      throw new Error(`Failed to process website: ${error.message}`);
    });
}
