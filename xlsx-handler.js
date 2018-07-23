const XLSX = require('xlsx');
const Parse = require('parse/node');
const _ = require('lodash');

const util = require('./util');

const moveCnadidateFromLocalToMain = util.moveCnadidateFromLocalToMain;
const moveRecruitersFromLocalToMain = util.moveRecruitersFromLocalToMain;

module.exports = async function xlsxHandler(data, dbCv, dbMain) {
  try {
    console.log(`xlsxHandler() ->`);

    const initial_data_arrays = await Parse.Cloud.run('getInititalDataArrays', {});
    console.log('xlsxHandler: initial data arrays obtained');
    const workbook = XLSX.readFile(data.filepath);

    if (workbook.SheetNames.some(name => name.toLowerCase().includes('recruiters'))) {
      console.log('xlsxHandler: Recruiters sheet detected');
      const secondSheetName = workbook.SheetNames[0];
      let recruiters = await XLSX.utils.sheet_to_json(workbook.Sheets[secondSheetName]);
      console.log('xlsxHandler: xlsx parsed to json');
      console.log(recruiters.length); //debug
      const chunk_size = 10;
      recruiters = _.chunk(recruiters, chunk_size);
      console.log(recruiters.length); //debug

      for (let i = 0; i < recruiters.length; i++) {
        await Parse.Cloud.run('saveXlsxRecruiters', {
          recruiters: recruiters[i],
          initial_data_arrays: initial_data_arrays,
        });
        console.log(`xlsxHandler: parsed recruiters[${i}] to local DB`);
      }
      console.log('xlsxHandler: parsed all recruiters to local DB');
      await moveRecruitersFromLocalToMain(dbCv, dbMain);
      console.log('xlsxHandler: moved Recruiters From LocalDB To MainDB');

      return;
    }

    const firstSheetName = workbook.SheetNames[0];
    let candidates = await XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
    console.log('xlsxHandler: xlsx parsed to json');
    console.log(`xlsxHandler: Quantity of candidates to be imported: ${candidates.length}`);
    const chunk_size = 10;
    candidates = _.chunk(candidates, chunk_size);

    const clientId = data.clientId;
    const funcName = 'saveXlsxCandidates';
    for (let i = 0; i < candidates.length; i++) {
      let candidatesChunked = candidates[i];
      let promisesCandidates = [];
      for (let j = 0; j < candidatesChunked.length; j++) {
        const email = candidatesChunked[j].Email;
        promisesCandidates.push(moveCnadidateFromLocalToMain(candidatesChunked[j], email, clientId, initial_data_arrays, funcName, dbCv, dbMain));
      }
      await Promise.all(promisesCandidates);
      console.log(promisesCandidates);
      const timeout = ms => new Promise(res => setTimeout(res, ms))
      await timeout(200);
    }

  } catch (err) {
    console.error(err);
    return err;
  }
}
