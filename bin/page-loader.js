#!/usr/bin/env node
import commander from 'commander';
import getFileFromURL from '../src/index.js';

const { program } = commander;

program
  .version('0.0.1')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action((URLToExamine, options) => {
    const outputDir = options.output || process.cwd();
    // console.log(`Directorio de salida: ${outputDir}`);
    getFileFromURL(URLToExamine, outputDir)
      .then(({ filepath, assetsDownloaded }) => console.log(`Page was downloaded at '${filepath}'. ${assetsDownloaded} assets downloaded.`))
      .catch((error) => {
        console.error(`\n🚨 Ocurrió un problema: ${error.message}\n`);
        process.exit(1);
      });
  })
  .parse(process.argv);
