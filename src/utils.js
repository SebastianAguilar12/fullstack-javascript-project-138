import * as cheerio from 'cheerio';
import path from 'path';
import axios from 'axios';
import * as fs from 'fs';

const getWebsiteName = (url) => {
  const urlClass = new URL(url);
  const webSiteName = urlClass.hostname + urlClass.pathname;
  return webSiteName;
};
const makeDashedFileName = (slug) => slug.replace(/[^a-zA-Z0-9]/g, '-');
const makeDashedDirName = (slug) => slug.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
const getImagesURL = (url) => {
  const imagesURL = new Set();
  const baseURL = new URL(url);
  return axios.get(url)
    .then((response) => {
      const $ = cheerio.load(response.data, { baseURI: baseURL.href });
      console.log('Obteniendo imágenes...');
      $('img').each((_, element) => {
        const possibleAttributes = ['src', 'data-src', 'srcset', 'data-original', 'data-lazy-src'];
        possibleAttributes.forEach((attribute) => {
          const imageURL = $(element).attr(attribute);
          if (imageURL) {
            console.log(`Encontrada imagen: ${imageURL}`);
            if (!imageURL.startsWith('http')) {
              const absoluteURL = new URL(imageURL, baseURL).toString();
              imagesURL.add(absoluteURL);
            } else {
              imagesURL.add(imageURL);
            }
          }
        });
      });
      const uniqueImagesURL = Array.from(imagesURL);
      console.log(`Encontradas ${uniqueImagesURL.length} imágenes.`);
      return uniqueImagesURL;
    })
    .catch((error) => {
      console.log('Error al obtener las imágenes: ', error);
      throw new Error('Error al obtener las imágenes: ', error);
    });
};
const downloadingDirName = (url) => {
  const urlName = getWebsiteName(url);
  const urlNameWithExtension = `${makeDashedDirName(urlName)}_files`;
  return urlNameWithExtension;
};
const downloadImage = (url, savingDir = downloadingDirName(url)) => {
  const imageName = url.split('/').pop(); // get the image name from the url
  const imageNamePath = path.join(savingDir, imageName); // set the path of saving directory
  return axios.get(url, { // ALWAYS RETURN THE PROMISE ITSELF
    responseType: 'stream',
    timeout: 5000,
  })
    .then((response) => new Promise((resolve, reject) => {
      const writableFile = fs.createWriteStream(imageNamePath);
      response.data.pipe(writableFile);
      writableFile.on('finish', () => {
        writableFile.close();
        console.log(`Imagen descargada en: ${imageNamePath}`);
        resolve(imageNamePath);
      });
      writableFile.on('error', (error) => {
        writableFile.close();
        fs.unlink(imageNamePath, () => { });
        console.log('Error al descargar la imagen: ', error);
        reject(error);
      });
      response.data.on('error', (error) => {
        writableFile.close();
        fs.unlink(imageNamePath, () => { });
        console.log('Error al descargar la imagen: ', error);
        reject(error);
      });
    }))
    .catch((error) => {
      console.log('Error al descargar la imagen: ', error);
      throw new Error('Error al descargar la imagen: ', error);
    });
};
const updateHTML = (htmlFilePath, imagesDirPath) => new Promise((resolve, reject) => {
  fs.readFile(htmlFilePath, 'utf-8', (error, response) => {
    if (error) {
      reject(error);
      return;
    }
    const $ = cheerio.load(String(response));
    $('img').each((_, element) => {
      const imageURL = $(element).attr('data-original');
      const imageName = imageURL.split('/').pop();
      const imageNamePath = path.join(imagesDirPath, imageName);
      $(element).attr('data-original', imageNamePath);
    });
    fs.writeFile(htmlFilePath, $.html(), 'utf-8', () => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

export {
  downloadingDirName,
  getWebsiteName,
  getImagesURL,
  makeDashedFileName,
  makeDashedDirName,
  downloadImage,
  updateHTML,
};
