import path from 'path';
import axios from 'axios';
import * as fs from 'fs';
import {
  getWebsiteName,
  downloadingDirName,
  makeDashedFileName,
  getImagesURL,
  downloadImage,
  updateHTML,
}
  from './utils.js';

export default function getFileFromURL(webSite, savingDir = process.cwd()) {
  const webSiteName = getWebsiteName(webSite);
  const webSiteNameWithExtension = `${makeDashedFileName(webSiteName)}.html`;
  const webSiteNameWithExtensionPath = path.join(savingDir, webSiteNameWithExtension);
  const dirContainer = downloadingDirName(webSite);
  const dirContainerPath = path.join(savingDir, dirContainer);
  // Create directory first
  const createDirectory = new Promise((resolve, reject) => {
    fs.access(dirContainerPath, (notAccess) => {
      if (notAccess) {
        console.log(`Creating directory ${dirContainerPath}...`);
        fs.mkdir(dirContainerPath, { recursive: true }, (error) => {
          if (error) {
            console.log(`Error creating directory ${dirContainerPath}: ${error.message}`);
            reject();
            throw new Error(`Failed to create directory ${dirContainerPath}: ${error.message}`);
          } else {
            console.log(`Directory ${dirContainer} created successfully.`);
            resolve();
          }
        });
      } else {
        console.log(`Directory ${dirContainerPath} already exists.`);
        resolve();
      }
    });
  });
  // Download HTML and handle images
  return createDirectory
    .then(() => Promise.all([
      // Download HTML
      axios.get(webSite)
        .then((response) => new Promise((resolve, reject) => {
          const writableFile = fs.createWriteStream(webSiteNameWithExtensionPath);
          writableFile.write(response.data);
          writableFile.on('finish', () => {
            console.log(`File downloaded to: ${webSiteNameWithExtensionPath}`);
            resolve(webSiteNameWithExtensionPath);
          });
          writableFile.on('error', reject);
          writableFile.end();
        })),
      // Handle images
      getImagesURL(webSite)
        .then((imagesURL) => {
          console.log(`Found ${imagesURL.length} images to download.`);
          return imagesURL.reduce(
            (promise, imageURL) => promise
              .then(() => downloadImage(imageURL, dirContainerPath))
              .catch((error) => {
                console.log(`Error downloading image ${imageURL}: ${error.message}`);
                return Promise.resolve();
              }),
            Promise.resolve(),
          );
        })
        .then(() => {
          console.log('All images downloaded.');
          return updateHTML(webSiteNameWithExtensionPath, dirContainerPath);
        }),
    ]))
    .then(() => {
      console.log('Website processed successfully.');
      return webSiteNameWithExtensionPath;
    })
    .catch((error) => {
      console.log('Error in getFileFromURL: ', error);
      throw new Error(`Failed to process website: ${error.message}`);
    });
}
