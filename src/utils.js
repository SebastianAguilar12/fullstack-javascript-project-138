import * as cheerio from 'cheerio';
import path from 'path';
import axios from 'axios';
import * as fs from 'fs';

const getWebsiteSlugName = (url) => {
  const urlClass = new URL(url);
  const webSiteName = urlClass.hostname + urlClass.pathname;
  return webSiteName;
};
const makeDashedFileName = (slug) => slug.replace(/[^a-zA-Z0-9]/g, '-');
const makeDashedDirName = (slug) => slug.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
const processedResource = ($, tagName, attributeName, baseUrl, baseDirName, assets) => {
  const $elements = $(tagName).toArray();
  const elementsWithUrls = $elements
    .map((element) => $(element))
    .filter(($element) => $element.attr(attributeName))
    .map(($element) => {
      const url = new URL($element.attr(attributeName), baseUrl);
      return ({ $element, url, baseUrl })})
    .filter(({ url }) => url.origin === baseUrl);
  console.log(elementsWithUrls);
  elementsWithUrls.forEach(({ $element, url }) => {
    const slug = makeDashedFileName(`${url.hostname}${url.pathname}`);
    const filepath = path.join(baseDirName, slug);
    assets.push({ url, filename: slug });
    $element.attr(attributeName, filepath);
  });
};
const processedResources = (baseURL, baseDirName, html) => {
  const $ = cheerio.load(html, { decodeEntities: true });
  const assets = [];
  processedResource($, 'img', 'src', baseURL, baseDirName, assets);
  processedResource($, 'link', 'href', baseURL, baseDirName, assets);
  processedResource($, 'script', 'src', baseURL, baseDirName, assets);
  console.log(assets);
  return { html: $.html(), assets };
};

const getImagesURL = (url) => {
  const imagesURL = new Set();
  const baseURL = new URL(url);
  return axios.get(url)
    .then((response) => {
      const $ = cheerio.load(response.data, { baseURI: baseURL.href });
      // console.log('Obteniendo imágenes...');
      $('img').each((_, element) => {
        const possibleAttributes = ['src', 'data-src', 'srcset', 'data-original', 'data-lazy-src'];
        possibleAttributes.forEach((attribute) => {
          const imageURL = $(element).attr(attribute);
          if (imageURL) {
            // console.log(`Encontrada imagen: ${imageURL}`);
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
      // console.log(`Encontradas ${uniqueImagesURL.length} imágenes.`);
      return uniqueImagesURL;
    })
    .catch((error) => {
      console.log('Error al obtener las imágenes: ', error);
      throw new Error('Error al obtener las imágenes: ', error);
    });
};
const downloadingDirName = (url) => {
  const urlName = getWebsiteSlugName(url);
  const urlNameWithExtension = `${makeDashedDirName(urlName)}_files`;
  return urlNameWithExtension;
};
//downloadAsset...
const downloadAsset = ($, tagName, attributeName) => {
  const $elements = $(tagName).toArray();
  const elementsWithUrls = $elements
    .map((element) => $(element))
    .filter(($element) => $element.attr(attributeName))
    .map(($element) => {
      const url = new URL($element.attr(attributeName));
      return ({ $element, url });
    });
  return axios.get(url, { // ALWAYS RETURN THE PROMISE ITSELF
    responseType: 'stream',
    timeout: 5000,
  })
    .then((response) => new Promise((resolve, reject) => {
      const writableFile = fs.createWriteStream(imageNamePath);
      response.data.pipe(writableFile);
      writableFile.on('finish', () => {
        writableFile.close();
        // console.log(`Imagen descargada en: ${imageNamePath}`);
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
const updateHTML = (htmlFilePath, assetsDirPath) => new Promise((resolve, reject) => {
  fs.readFile(htmlFilePath, 'utf-8', (error, response) => {
    if (error) {
      reject(error);
      return;
    }
    const $ = cheerio.load(String(response));
    const attributes = ['src', 'data-src', 'srcset', 'data-original', 'data-lazy-src'];
    $('img').each((_, element) => {
      attributes.forEach((attribute) => {
        const imageURL = $(element).attr(attribute);
        if (imageURL) {
          const imageName = imageURL.split('/').pop();
          const imageNamePath = path.join(assetsDirPath, imageName);
          $(element).attr(attribute, imageNamePath);
        }
      });
    });
    $('link').each((_, element) => {
      const linkURL = $(element).attr('href');
      if (linkURL) {
        const newName = makeDashedFileName(new URL(linkURL, 'https://dummy.com').pathname);
        $(element).attr('href', path.join(path.basename(assetsDirPath), newName));
      }
    });
    $('script').each((_, element) => {
      const scriptURL = $(element).attr('src');
      if (scriptURL) {
        const newName = makeDashedFileName(new URL(scriptURL, 'https://dummy.com').pathname);
        $(element).attr('src', path.join(path.basename(assetsDirPath), newName));
      }
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
  getWebsiteSlugName,
  getImagesURL,
  makeDashedFileName,
  makeDashedDirName,
  downloadImage,
  updateHTML,
  getLocalAsset,
  downloadAsset,
  processedResources,
};
