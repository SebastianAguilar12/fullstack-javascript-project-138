#!/usr/bin/env node
import commander from 'commander';
import getFileFromURL from '../src/index.js';

const { program } = commander;

program
  .version('0.0.1')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action(async (URLToExamine, options) => {
    const outputDir = options.output || process.cwd();
    // console.log(`Directorio de salida: ${outputDir}`);
    await getFileFromURL(URLToExamine, outputDir);
  })
  .parse(process.argv);
