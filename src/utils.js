import * as cheerio from 'cheerio';
import path from 'path';
import * as fs from 'fs';
import { Listr } from 'listr2';
import axios from './axiosInstance.js';

const normalizeUrl = (input) => {
  if (!/^https?:\/\//i.test(input)) {
    return `https://${input}`;
  }
  return input;
};
const getWebsiteSlugName = (url) => {
  const urlClass = new URL(url);
  const webSiteName = urlClass.hostname + urlClass.pathname;
  return webSiteName;
};
const makeDashedFileName = (url) => {
  const normalizedUrl = normalizeUrl(url);
  const { hostname, pathname } = new URL(normalizedUrl);
  const combined = path.join(hostname, pathname);
  return combined
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};
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
    .filter(({ url }) => {
      const mainUrl = new URL(baseUrl);
      const isSameOrigin = url.origin === mainUrl.origin;
      const isLocalPath = url.pathname.startsWith('/');
      return isSameOrigin && isLocalPath;
    });
  elementsWithUrls.forEach(({ $element, url }) => {
    const ext = path.extname(url.pathname); // e.g. '.css'
    const pathnameWithoutExt = url.pathname.slice(0, url.pathname.length - ext.length);

    const dashedName = makeDashedFileName(`${url.hostname}${pathnameWithoutExt}`);
    const slug = `${dashedName}${ext}`;

    const filepath = path.join(path.basename(baseDirName), slug);
    assets.push({ url, filename: slug });
    $element.attr(attributeName, filepath);
  });
};
const processedResources = (baseURL, baseDirName, html) => {
  const $ = cheerio.load(html, { decodeEntities: true });
  const assets = [];

  processedResource($, 'img', 'src', baseURL, baseDirName, assets);
  processedResource($, 'script', 'src', baseURL, baseDirName, assets);

  $('link').each((_, elem) => {
    const $element = $(elem);
    const href = $element.attr('href');
    const rel = $element.attr('rel');
    if (!href || rel !== 'stylesheet') return;
    const url = new URL(href, baseURL);
    const mainUrl = new URL(baseURL);
    const isSameOrigin = url.origin === mainUrl.origin;
    const pagePath = mainUrl.pathname.endsWith('/')
      ? mainUrl.pathname
      : `${mainUrl.pathname}/`;
    const isSubresource = url.pathname.startsWith(pagePath);
    if (isSameOrigin && isSubresource) {
      const ext = path.extname(url.pathname);
      const pathnameWithoutExt = url.pathname.slice(0, url.pathname.length - ext.length);
      const dashedName = makeDashedFileName(`${url.hostname}${pathnameWithoutExt}`);
      const slug = `${dashedName}${ext}`;
      const filepath = path.join(path.basename(baseDirName), slug);
      $element.attr('href', filepath);
      assets.push({ url, filename: slug });
    }
  });

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
    throw new Error(`Error descargando el recurso: ${error.config?.url || 'desconocido'}`);
  });
const downloadAssetsConcurrently = (dirname, assets) => {
  const tasks = new Listr(assets.map((asset) => ({
    title: `Descargando ${asset.filename}`,
    task: () => downloadAsset(dirname, asset),
  })), {
    concurrent: true,
    exitOnError: false,
    rendererOptions: { collapse: false },
  });
  return tasks.run();
};

const sanitizeOutputDir = (dir) => {
  const restrictedPaths = ['/sys', '/etc', '/bin', '/usr', '/lib'];
  const finalDir = dir || process.cwd();
  return restrictedPaths.includes(finalDir) ? null : finalDir;
};

export {
  downloadingDirName,
  getWebsiteSlugName,
  makeDashedFileName,
  makeDashedDirName,
  processedResources,
  downloadAssetsConcurrently,
  sanitizeOutputDir,
};
