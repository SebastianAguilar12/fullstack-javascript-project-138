import * as cheerio from 'cheerio';
import path from 'path';
import * as fs from 'fs';
import Listr from 'listr';
import axios from './axiosInstance.js';

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
      return ({ $element, url, baseUrl });
    })
    .filter(({ url }) => url.origin === baseUrl);
  // console.log(elementsWithUrls);
  elementsWithUrls.forEach(({ $element, url }) => {
    let baseName = path.basename(url.pathname);
    if (baseName === '') {
      baseName = 'index.html';
    } else {
      baseName = `${baseName}`;
    }
    const ext = path.extname(baseName); // obtiene extensión como .png, .css, etc.
    const baseWithoutExt = baseName.replace(ext, '');
    const slug = `${makeDashedFileName(`${url.hostname}-${baseWithoutExt}`)}${ext}`;
    const filepath = path.join(path.basename(baseDirName), slug);
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
  // console.log(assets);
  // console.log({ html: $.html(), assets });
  return { html: $.html(), assets };
};

const downloadingDirName = (url) => {
  const urlName = getWebsiteSlugName(url);
  const urlNameWithExtension = `${makeDashedDirName(urlName)}_files`;
  return urlNameWithExtension;
};
// downloadAsset...
const downloadAsset = (dirname, { url, filename }) => axios.get(url.toString(), { responseType: 'arraybuffer' })
  .then((response) => fs.promises.mkdir(dirname, { recursive: true })
    .then(() => {
      const fullpath = path.join(dirname, filename);
      return fs.promises.writeFile(fullpath, response.data);
    }))
  .catch((error) => {
    // Aquí decides si quieres lanzar el error o terminar el proceso
    throw new Error(`Error descargando el recurso: ${error.config?.url || 'desconocido'}`);
  });
const downloadAssetsSequentially = (dirname, assets) => {
  const tasks = new Listr(assets.map((asset) => ({
    title: `Descargando ${asset.filename}`,
    task: () => downloadAsset(dirname, asset),
  })), { concurrent: false });
  return tasks.run();
};

export {
  downloadingDirName,
  getWebsiteSlugName,
  makeDashedFileName,
  makeDashedDirName,
  processedResources,
  downloadAssetsSequentially,
};
